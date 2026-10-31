import { ApiError, apiRequest, clearCsrfToken } from "./api-client.ts";

export interface OwnerAuth {
  user: { id: string; name: string; email: string };
  restaurant: { id: string; name: string; slug: string; currency: string };
}

export function parseOwnerAuth(value: unknown): OwnerAuth {
  if (!value || typeof value !== "object") throw new ApiError(null, "Invalid server response");
  const context = value as Partial<OwnerAuth>;
  const user = context.user;
  const restaurant = context.restaurant;
  if (!user || !restaurant ||
      ![user.id, user.name, user.email, restaurant.id, restaurant.name,
        restaurant.slug, restaurant.currency].every((field) => typeof field === "string" && field.length > 0)) {
    throw new ApiError(null, "Invalid server response");
  }
  return context as OwnerAuth;
}

export async function loginOwner(email: string, password: string): Promise<OwnerAuth> {
  clearCsrfToken();
  return parseOwnerAuth(await apiRequest<unknown>("/api/auth/login", {
    method: "POST",
    body: { email: email.trim().toLowerCase(), password },
    csrf: "login",
  }));
}

export async function restoreOwner(): Promise<OwnerAuth> {
  return parseOwnerAuth(await apiRequest<unknown>("/api/auth/me"));
}

export async function logoutOwner(): Promise<void> {
  await apiRequest<void>("/api/auth/logout", { method: "POST", csrf: "session" });
  clearCsrfToken();
}
