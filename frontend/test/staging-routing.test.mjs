import assert from "node:assert/strict";
import { test } from "node:test";
import { apiRequest } from "../src/services/api-client.ts";
import { getPublicRestaurant } from "../src/services/public-menu.ts";
import { buildCheckoutPayload, submitGuestCheckout } from "../src/services/guest-checkout-service.ts";

test("Preview browser API uses its own origin and server rendering uses the private Service binding", async () => {
  const previousPublic = process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL;
  const previousInternal = process.env.SAVORA_INTERNAL_API_URL;
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  try {
    delete process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL;
    process.env.SAVORA_INTERNAL_API_URL = "http://backend.internal";
    globalThis.window = { location: { origin: "https://food-delivery-preview.vercel.app" } };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://food-delivery-preview.vercel.app/api/health");
      assert.equal(options.credentials, "include");
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    };
    assert.deepEqual(await apiRequest("/api/health"), { status: "ok" });

    const productId = "507f1f77bcf86cd799439012";
    for (const method of ["direct", "whatsapp"]) {
      const payload = buildCheckoutPayload({ fullName: "Test Guest", phone: "+201001234567",
        address: "Test Street", city: "Cairo", notes: "" }, [{ productId, quantity: 1 }], method);
      globalThis.fetch = async (url, options) => {
        assert.equal(url, "/api/public/restaurants/cafe/orders");
        assert.equal(options.method, "POST");
        assert.equal(options.credentials, "same-origin");
        assert.equal(JSON.parse(options.body).submissionMethod, method);
        return new Response(JSON.stringify({ order: { orderNumber: "SV-123", status: "pending",
          submissionMethod: method, currency: "EGP", subtotal: 20, deliveryFee: 0,
          total: 20, savedInSavora: true }, ...(method === "whatsapp" ?
          { whatsapp: { url: "https://wa.me/201001234567", messageSent: false } } : {}) }), { status: 201 });
      };
      assert.equal((await submitGuestCheckout("cafe", payload, "12345678-1234-1234-1234-123456789012")).order.orderNumber, "SV-123");
    }

    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/api/public/restaurants/cafe");
      assert.equal(options.credentials, "same-origin");
      return new Response(JSON.stringify({ restaurant: { slug: "cafe" } }), { status: 200 });
    };
    assert.equal((await getPublicRestaurant("cafe")).slug, "cafe");

    delete globalThis.window;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "http://backend.internal/api/public/restaurants/cafe");
      assert.equal(options.credentials, "same-origin");
      return new Response(JSON.stringify({ restaurant: { slug: "cafe" } }), { status: 200 });
    };
    assert.equal((await getPublicRestaurant("cafe")).slug, "cafe");
  } finally {
    if (previousPublic === undefined) delete process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL;
    else process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = previousPublic;
    if (previousInternal === undefined) delete process.env.SAVORA_INTERNAL_API_URL;
    else process.env.SAVORA_INTERNAL_API_URL = previousInternal;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});
