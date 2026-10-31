export class PlatformApiError extends Error {
  readonly status: number | null;
  constructor(status: number | null, message: string) { super(message); this.status = status; }
}
export interface PlatformAdmin { id: string; email: string }
export interface PlatformRestaurant {
  id: string; name: string; slug: string; currency: string; description: string | null;
  storefrontTheme: "savora-classic" | "savora-aqua" | "savora-cafe" | "savora-luxury";
  status: "active" | "suspended"; createdAt: string; updatedAt: string;
  owner: { id: string; name: string; email: string; isActive: boolean } | null;
}
export interface PlatformList { restaurants: PlatformRestaurant[]; page: number; limit: number; total: number }
let csrf: string | null = null;
export function clearAdminCsrf() { csrf = null; }
function base() {
  const value = process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL ||
    (typeof window === "undefined" ? process.env.SAVORA_INTERNAL_API_URL : window.location.origin);
  if (!value) throw new PlatformApiError(null, "API URL is not configured");
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" ||
        url.username || url.password || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw new PlatformApiError(null, "API URL is invalid"); }
}
async function request<T>(path: string, options: { method?: "GET" | "POST" | "PATCH";
  body?: unknown; login?: boolean; mutation?: boolean; signal?: AbortSignal } = {}): Promise<T> {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.login) headers.set("X-Savora-CSRF", "1");
  if (options.mutation) {
    if (!csrf) {
      const response = await request<{ csrfToken: string }>("/auth/csrf");
      if (!/^[0-9a-f]{64}$/.test(response.csrfToken)) throw new PlatformApiError(null, "Invalid response");
      csrf = response.csrfToken;
    }
    headers.set("X-Savora-CSRF", csrf);
  }
  let response: Response;
  try {
    response = await fetch(`${base()}/api/admin${path}`, { method: options.method ?? "GET",
      headers, body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include", cache: "no-store",
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20_000)]) :
        AbortSignal.timeout(20_000) });
  } catch { throw new PlatformApiError(null, "Cannot reach the server"); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) csrf = null;
    throw new PlatformApiError(response.status, response.status === 409 ? "Conflict" :
      response.status === 400 ? "Invalid input" : response.status === 401 ? "Unauthorized" :
      response.status === 403 ? "Forbidden" : "Request failed");
  }
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch { throw new PlatformApiError(null, "Invalid server response"); }
}
export async function loginAdmin(email: string, password: string) {
  csrf = null;
  return request<{ admin: PlatformAdmin }>("/auth/login", { method: "POST", login: true,
    body: { email: email.trim().toLowerCase(), password } });
}
export const restoreAdmin = () => request<{ admin: PlatformAdmin }>("/auth/me");
export async function logoutAdmin() {
  await request<void>("/auth/logout", { method: "POST", mutation: true });
  csrf = null;
}
export const adminOverview = () => request<{ total: number; active: number; suspended: number }>("/overview");
export const adminRestaurants = (page: number, search: string, signal?: AbortSignal) =>
  request<PlatformList>(`/restaurants?page=${page}&limit=20&search=${encodeURIComponent(search)}`, { signal });
export const adminRestaurant = (id: string) =>
  request<{ restaurant: PlatformRestaurant }>(`/restaurants/${encodeURIComponent(id)}`);
export const createAdminRestaurant = (body: { restaurant: { name: string; slug: string;
  currency: string; description?: string; storefrontTheme?: PlatformRestaurant["storefrontTheme"] }; owner: { name: string; email: string; password: string } }) =>
  request<{ restaurant: PlatformRestaurant }>("/restaurants", { method: "POST", mutation: true, body });
export const setAdminRestaurantStatus = (id: string, status: "active" | "suspended") =>
  request<{ restaurant: PlatformRestaurant }>(`/restaurants/${encodeURIComponent(id)}/status`,
    { method: "PATCH", mutation: true, body: { status } });
export const setAdminRestaurantTheme = (id: string, storefrontTheme: PlatformRestaurant["storefrontTheme"]) =>
  request<{ restaurant: PlatformRestaurant }>(`/restaurants/${encodeURIComponent(id)}/theme`,
    { method: "PATCH", mutation: true, body: { storefrontTheme } });
