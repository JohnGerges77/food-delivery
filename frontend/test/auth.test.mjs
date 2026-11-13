import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError, apiRequest, clearCsrfToken } from "../src/services/api-client.ts";
import { restoreOwner } from "../src/services/auth-service.ts";
import { dashboardAccess, useAuthStore } from "../src/store/auth-store.ts";

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
const originalSessionStorage = globalThis.sessionStorage;
const context = {
  user: { id: "owner-id", name: "Owner", email: "owner@example.com" },
  restaurant: { id: "restaurant-id", name: "Cafe", slug: "cafe", currency: "EGP" },
};
const token = "a".repeat(64);
process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = "http://localhost:5000";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalStorage;
  globalThis.sessionStorage = originalSessionStorage;
  clearCsrfToken();
  useAuthStore.setState({ status: "loading", context: null });
});

test("login sends credentials and bootstrap header, maps owner and restaurant, stores no token", async () => {
  globalThis.localStorage = { setItem() { throw new Error("token storage used"); } };
  globalThis.sessionStorage = { setItem() { throw new Error("token storage used"); } };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:5000/api/auth/login");
    assert.equal(options.credentials, "include");
    assert.equal(options.headers.get("X-Savora-CSRF"), "1");
    assert.deepEqual(JSON.parse(options.body), { email: "owner@example.com", password: "abcdefghijkl" });
    return json(context);
  };
  await useAuthStore.getState().login(" Owner@Example.com ", "abcdefghijkl");
  assert.equal(useAuthStore.getState().status, "authenticated");
  assert.deepEqual(useAuthStore.getState().context, context);
});

test("invalid credentials stay unauthenticated", async () => {
  globalThis.fetch = async () => json({ error: "Invalid credentials" }, 401);
  await assert.rejects(useAuthStore.getState().login("owner@example.com", "abcdefghijkl"),
    (error) => error instanceof ApiError && error.status === 401);
  assert.equal(useAuthStore.getState().status, "unauthenticated");
});

test("session restoration maps /me, and expired session hides owner context", async () => {
  let expired = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:5000/api/auth/me");
    assert.equal(options.credentials, "include");
    return expired ? json({ error: "Unauthorized" }, 401) : json(context);
  };
  await useAuthStore.getState().restore();
  assert.deepEqual(useAuthStore.getState().context?.restaurant, context.restaurant);
  expired = true;
  await useAuthStore.getState().restore();
  assert.equal(useAuthStore.getState().status, "unauthenticated");
  assert.equal(useAuthStore.getState().context, null);
});

test("background session revalidation keeps the authenticated shell mounted and deduplicates requests", async () => {
  useAuthStore.setState({ status: "authenticated", context });
  let resolveRequest;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Promise((resolve) => { resolveRequest = resolve; }); };
  const first = useAuthStore.getState().revalidate();
  const second = useAuthStore.getState().revalidate();
  assert.equal(calls, 1);
  assert.equal(useAuthStore.getState().status, "authenticated");
  assert.deepEqual(useAuthStore.getState().context, context);
  resolveRequest(json(context));
  await Promise.all([first, second]);
  assert.equal(useAuthStore.getState().status, "authenticated");
});

test("background revalidation revokes expired sessions and cannot undo logout", async () => {
  useAuthStore.setState({ status: "authenticated", context });
  globalThis.fetch = async () => json({ error: "Unauthorized" }, 401);
  await useAuthStore.getState().revalidate();
  assert.equal(useAuthStore.getState().status, "unauthenticated");
  assert.equal(useAuthStore.getState().context, null);

  useAuthStore.setState({ status: "authenticated", context });
  let finish;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/me')) return new Promise((resolve) => { finish = resolve; });
    if (url.endsWith('/csrf')) return json({ csrfToken: token });
    return new Response(null, { status: 204 });
  };
  const pending = useAuthStore.getState().revalidate();
  await useAuthStore.getState().logout();
  finish(json(context));
  await pending;
  assert.equal(useAuthStore.getState().status, "unauthenticated");
  assert.equal(useAuthStore.getState().context, null);
});

test("a protected API rejection supersedes an older successful background check", async () => {
  useAuthStore.setState({ status: "authenticated", context });
  let finish;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1 ? new Promise((resolve) => { finish = resolve; }) : json({ error: "Unauthorized" }, 401);
  };
  const background = useAuthStore.getState().revalidate();
  const forced = useAuthStore.getState().restore();
  assert.equal(useAuthStore.getState().status, "loading");
  finish(json(context));
  await Promise.all([background, forced]);
  assert.equal(calls, 2);
  assert.equal(useAuthStore.getState().status, "unauthenticated");
  assert.equal(useAuthStore.getState().context, null);
});

test("temporary background network errors preserve an already validated session", async () => {
  useAuthStore.setState({ status: "authenticated", context });
  globalThis.fetch = async () => { throw new TypeError("offline"); };
  await useAuthStore.getState().revalidate();
  assert.equal(useAuthStore.getState().status, "authenticated");
  assert.deepEqual(useAuthStore.getState().context, context);
});

test("a generic background 403 does not claim that the owner session expired", async () => {
  useAuthStore.setState({ status: "authenticated", context });
  globalThis.fetch = async () => json({ error: "Forbidden" }, 403);
  await useAuthStore.getState().revalidate();
  assert.equal(useAuthStore.getState().status, "authenticated");
  assert.deepEqual(useAuthStore.getState().context, context);
});

test("protected dashboard waits, redirects unauthenticated users, and shows authenticated users", () => {
  assert.equal(dashboardAccess("loading", false), "wait");
  assert.equal(dashboardAccess("unavailable", false), "wait");
  assert.equal(dashboardAccess("unauthenticated", false), "redirect");
  assert.equal(dashboardAccess("authenticated", false), "show");
  assert.equal(dashboardAccess("unauthenticated", true), "login");
});

test("CSRF bootstrap sends a session token header on logout and never caches responses", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/csrf")) return json({ csrfToken: token });
    return new Response(null, { status: 204 });
  };
  await apiRequest("/api/auth/logout", { method: "POST", csrf: "session" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "http://localhost:5000/api/auth/csrf");
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls[1].options.headers.get("X-Savora-CSRF"), token);
  assert.equal(calls[1].options.cache, "no-store");
});

test("confirmed logout clears state, while failed logout does not claim revocation", async () => {
  useAuthStore.setState({ status: "authenticated", context });
  globalThis.fetch = async (url) => url.endsWith("/csrf") ? json({ csrfToken: token }) : new Response(null, { status: 204 });
  await useAuthStore.getState().logout();
  assert.equal(useAuthStore.getState().status, "unauthenticated");
  assert.equal(useAuthStore.getState().context, null);

  useAuthStore.setState({ status: "authenticated", context });
  globalThis.fetch = async (url) => url.endsWith("/csrf") ? json({ csrfToken: token }) : json({ error: "Service unavailable" }, 503);
  await assert.rejects(useAuthStore.getState().logout());
  assert.equal(useAuthStore.getState().status, "unavailable");
});

test("revoked logout session is treated as signed out", async () => {
  useAuthStore.setState({ status: "authenticated", context });
  globalThis.fetch = async () => json({ error: "Unauthorized" }, 401);
  await useAuthStore.getState().logout();
  assert.equal(useAuthStore.getState().status, "unauthenticated");
});

test("network failure blocks protected data and can be retried", async () => {
  globalThis.fetch = async () => { throw new TypeError("Network failure"); };
  await useAuthStore.getState().restore();
  assert.equal(useAuthStore.getState().status, "unavailable");
  assert.equal(useAuthStore.getState().context, null);
  globalThis.fetch = async () => json(context);
  await useAuthStore.getState().restore();
  assert.equal(useAuthStore.getState().status, "authenticated");
});

test("malformed /me response cannot authenticate an owner", async () => {
  globalThis.fetch = async () => json({ user: context.user, restaurant: { id: "forged" } });
  await assert.rejects(restoreOwner(), /Invalid server response/);
  await useAuthStore.getState().restore();
  assert.equal(useAuthStore.getState().status, "unavailable");
});
