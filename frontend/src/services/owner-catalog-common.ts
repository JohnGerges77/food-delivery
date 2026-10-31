import { ApiError } from "./api-client.ts";

export interface OwnerPagination {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parsePagination(value: unknown): OwnerPagination {
  if (!isRecord(value) || !Number.isSafeInteger(value.page) || !Number.isSafeInteger(value.limit) ||
      !Number.isSafeInteger(value.total) || typeof value.hasNext !== "boolean" ||
      (value.page as number) < 1 || (value.limit as number) < 1 || (value.total as number) < 0) {
    throw new ApiError(null, "Invalid server response");
  }
  return value as unknown as OwnerPagination;
}

export const isObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);
export const validSlug = (value: string) => value.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export function validOwnerImageUrl(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("/")) {
    return !value.startsWith("//") && !/[\\\s\x00-\x1f]/.test(value) &&
      !value.split(/[/?#]/).includes("..");
  }
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

export function ownerCatalogError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Request rejected. Check trusted Origin and CSRF settings, then retry.";
    if (error.status === 400) return "The server rejected these values. Review the form and retry.";
    if (error.status === 404) return "This record or its category is no longer available. Refresh and retry.";
    if (error.status === 409) return "This slug is already used. Choose another slug.";
  }
  return fallback;
}
