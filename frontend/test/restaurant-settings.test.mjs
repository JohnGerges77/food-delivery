import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError, clearCsrfToken } from "../src/services/api-client.ts";
import { getOwnerRestaurant, patchOwnerRestaurant, restaurantToForm, settingsPatch,
  validateSettingsForm } from "../src/services/owner-restaurant-service.ts";
import { useAuthStore } from "../src/store/auth-store.ts";

const originalFetch = globalThis.fetch;
const csrfToken = "a".repeat(64);
process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = "http://localhost:5000";

function dto(overrides = {}) {
  return {
    id: "restaurant-id", name: "Cafe", slug: "cafe", currency: "EGP", status: "active",
    description: null, logoUrl: null, phone: null, contactEmail: null, address: null, openingHours: null,
    deliverySettings: { deliveryFee: 0, minimumOrder: null, estimatedDeliveryTime: null, deliveryAvailable: false },
    socialLinks: { facebook: null, instagram: null, whatsapp: null },
    branding: { brandName: null, primaryColor: null }, ...overrides,
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearCsrfToken();
  useAuthStore.setState({ status: "loading", context: null });
});

test("GET uses owner session, maps optional blanks and preserves valid zero and false", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:5000/api/owner/restaurant");
    assert.equal(options.credentials, "include");
    assert.equal(options.cache, "no-store");
    return json({ restaurant: dto() });
  };
  const form = restaurantToForm(await getOwnerRestaurant());
  assert.equal(form.name, "Cafe");
  assert.equal(form.deliveryFee, "0");
  assert.equal(form.deliveryAvailable, false);
  assert.equal(form.minimumOrder, "");
  assert.equal(form.facebook, "");
  assert.equal(form.primaryColor, "");
});

test("PATCH sends only changed writable fields with session CSRF, then GET sees canonical values", async () => {
  const calls = [];
  const initial = dto({ deliverySettings: { deliveryFee: 0, minimumOrder: 10, estimatedDeliveryTime: "30 min", deliveryAvailable: true },
    socialLinks: { facebook: "https://facebook.com/cafe", instagram: null, whatsapp: "https://wa.me/20123456789" } });
  const form = { ...restaurantToForm(initial), name: "Cafe New", deliveryFee: "1.25", instagram: "https://instagram.com/cafe" };
  const patch = settingsPatch(form, initial);
  assert.deepEqual(patch, { name: "Cafe New", deliverySettings: { deliveryFee: 1.25 },
    socialLinks: { instagram: "https://instagram.com/cafe" } });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/csrf")) return json({ csrfToken });
    if (options.method === "PATCH") {
      assert.equal(options.credentials, "include");
      assert.equal(options.headers.get("X-Savora-CSRF"), csrfToken);
      assert.deepEqual(JSON.parse(options.body), patch);
      return json({ restaurant: { ...initial, ...patch,
        deliverySettings: { ...initial.deliverySettings, ...patch.deliverySettings },
        socialLinks: { ...initial.socialLinks, ...patch.socialLinks } } });
    }
    return json({ restaurant: { ...initial, name: "Cafe New", deliverySettings: { ...initial.deliverySettings, deliveryFee: 1.25 },
      socialLinks: { ...initial.socialLinks, instagram: "https://instagram.com/cafe" } } });
  };
  const saved = await patchOwnerRestaurant(patch);
  assert.equal(saved.deliverySettings.minimumOrder, 10);
  assert.equal(saved.socialLinks.whatsapp, initial.socialLinks.whatsapp);
  assert.equal(saved.name, "Cafe New");
  assert.equal((await getOwnerRestaurant()).deliverySettings.deliveryFee, 1.25);
  assert.equal(calls.length, 3);
});

test("validation rejects invalid fields and missing amounts cannot be cleared", () => {
  const initial = dto();
  const form = { ...restaurantToForm(initial), name: " ", contactEmail: "bad", facebook: "javascript:alert(1)",
    primaryColor: "orange", deliveryFee: "", minimumOrder: "1.234" };
  const errors = validateSettingsForm(form, initial);
  for (const key of ["name", "contactEmail", "facebook", "primaryColor", "deliveryFee", "minimumOrder"]) {
    assert.ok(errors[key], key);
  }
  assert.throws(() => settingsPatch(form, initial));
  const large = { ...restaurantToForm(initial), deliveryFee: "9007199254740992" };
  assert.ok(validateSettingsForm(large, initial).deliveryFee);
});

test("failed save and network failure do not claim persistence; malformed GET has no fixture fallback", async () => {
  const form = restaurantToForm(dto());
  form.name = "Changed";
  globalThis.fetch = async (url) => url.endsWith("/csrf") ? json({ csrfToken }) : json({ error: "Invalid settings" }, 400);
  await assert.rejects(patchOwnerRestaurant(settingsPatch(form, dto())),
    (error) => error instanceof ApiError && error.status === 400);
  globalThis.fetch = async () => { throw new TypeError("offline"); };
  await assert.rejects(getOwnerRestaurant(), (error) => error instanceof ApiError && error.status === null);
  globalThis.fetch = async () => json({ restaurant: { name: "fixture?" } });
  await assert.rejects(getOwnerRestaurant(), /Invalid server response/);
});

test("expired session remains 401, and shared summary updates only for matching owner tenant", async () => {
  globalThis.fetch = async () => json({ error: "Unauthorized" }, 401);
  await assert.rejects(getOwnerRestaurant(), (error) => error instanceof ApiError && error.status === 401);
  const context = { user: { id: "owner", name: "Owner", email: "owner@example.com" },
    restaurant: { id: "restaurant-id", name: "Cafe", slug: "cafe", currency: "EGP" } };
  useAuthStore.setState({ status: "authenticated", context });
  useAuthStore.getState().updateRestaurantSummary({ ...context.restaurant, id: "foreign", name: "Wrong" });
  assert.equal(useAuthStore.getState().context.restaurant.name, "Cafe");
  useAuthStore.getState().updateRestaurantSummary({ ...context.restaurant, name: "Cafe New" });
  assert.equal(useAuthStore.getState().context.restaurant.name, "Cafe New");
});

test("403 save failure does not bypass CSRF and retry obtains a fresh token", async () => {
  let tokenCalls = 0;
  let patchCalls = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) return json({ csrfToken: (++tokenCalls).toString(16).repeat(64) });
    patchCalls++;
    assert.equal(options.headers.get("X-Savora-CSRF"), patchCalls.toString(16).repeat(64));
    return patchCalls === 1 ? json({ error: "Request rejected" }, 403) : json({ restaurant: dto({ name: "Updated" }) });
  };
  await assert.rejects(patchOwnerRestaurant({ name: "Updated" }),
    (error) => error instanceof ApiError && error.status === 403);
  assert.equal((await patchOwnerRestaurant({ name: "Updated" })).name, "Updated");
  assert.equal(tokenCalls, 2);
});
