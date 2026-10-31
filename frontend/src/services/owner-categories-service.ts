import { ApiError, apiRequest } from "./api-client.ts";
import { isRecord, parsePagination, validOwnerImageUrl, validSlug, type OwnerPagination } from "./owner-catalog-common.ts";

export interface OwnerCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryFormValues {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: string;
  isActive: boolean;
}

export type CategoryWrite = Pick<OwnerCategory, "name" | "slug" | "description" | "imageUrl" | "sortOrder" | "isActive">;
export type CategoryPatch = Partial<CategoryWrite>;
export type CategorySort = "sortOrder" | "-sortOrder";

export function parseOwnerCategory(value: unknown): OwnerCategory {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id ||
      typeof value.name !== "string" || typeof value.slug !== "string" ||
      !(value.description === null || typeof value.description === "string") ||
      !(value.imageUrl === null || typeof value.imageUrl === "string") ||
      !Number.isSafeInteger(value.sortOrder) || typeof value.isActive !== "boolean") {
    throw new ApiError(null, "Invalid server response");
  }
  return value as unknown as OwnerCategory;
}

function parseOne(value: unknown): OwnerCategory {
  if (!isRecord(value)) throw new ApiError(null, "Invalid server response");
  return parseOwnerCategory(value.category);
}

export async function listOwnerCategories(options: { page?: number; limit?: number; sort?: CategorySort } = {}):
  Promise<{ categories: OwnerCategory[]; pagination: OwnerPagination }> {
  const params = new URLSearchParams({ page: String(options.page ?? 1), limit: String(options.limit ?? 12), sort: options.sort ?? "sortOrder" });
  const response = await apiRequest<unknown>(`/api/owner/categories?${params}`);
  if (!isRecord(response) || !Array.isArray(response.categories)) throw new ApiError(null, "Invalid server response");
  return { categories: response.categories.map(parseOwnerCategory), pagination: parsePagination(response.pagination) };
}

export async function allOwnerCategories(): Promise<OwnerCategory[]> {
  const all: OwnerCategory[] = [];
  for (let page = 1; page <= 1000; page++) {
    const result = await listOwnerCategories({ page, limit: 100 });
    all.push(...result.categories);
    if (!result.pagination.hasNext) return all;
  }
  throw new ApiError(null, "Category list exceeds supported pages");
}

export async function getOwnerCategory(id: string): Promise<OwnerCategory> {
  return parseOne(await apiRequest<unknown>(`/api/owner/categories/${encodeURIComponent(id)}`));
}

export async function createOwnerCategory(body: CategoryWrite): Promise<OwnerCategory> {
  return parseOne(await apiRequest<unknown>("/api/owner/categories", { method: "POST", body, csrf: "session" }));
}

export async function patchOwnerCategory(id: string, body: CategoryPatch): Promise<OwnerCategory> {
  return parseOne(await apiRequest<unknown>(`/api/owner/categories/${encodeURIComponent(id)}`, { method: "PATCH", body, csrf: "session" }));
}

export async function deleteOwnerCategory(id: string): Promise<void> {
  await apiRequest<void>(`/api/owner/categories/${encodeURIComponent(id)}`, { method: "DELETE", csrf: "session" });
}

export function categoryToForm(category?: OwnerCategory): CategoryFormValues {
  return { name: category?.name ?? "", slug: category?.slug ?? "", description: category?.description ?? "",
    imageUrl: category?.imageUrl ?? "", sortOrder: String(category?.sortOrder ?? 0), isActive: category?.isActive ?? true };
}

export function validateCategoryForm(form: CategoryFormValues): Partial<Record<keyof CategoryFormValues, string>> {
  const errors: Partial<Record<keyof CategoryFormValues, string>> = {};
  if (!form.name.trim() || form.name.length > 120) errors.name = "Enter a name of 1–120 characters.";
  if (!validSlug(form.slug.trim().toLowerCase())) errors.slug = "Use lowercase letters, numbers and single hyphens (max 120).";
  if (form.description.length > 2048) errors.description = "Use 2048 characters or fewer.";
  if (form.imageUrl.length > 2048 || !validOwnerImageUrl(form.imageUrl.trim())) errors.imageUrl = "Enter a root-relative path or HTTP(S) URL.";
  if (!/^\d+$/.test(form.sortOrder.trim()) || Number(form.sortOrder) > 1_000_000 || !Number.isSafeInteger(Number(form.sortOrder))) errors.sortOrder = "Enter a whole number from 0 to 1,000,000.";
  return errors;
}

export function categoryWrite(form: CategoryFormValues): CategoryWrite {
  if (Object.keys(validateCategoryForm(form)).length) throw new Error("Invalid category form");
  return { name: form.name.trim(), slug: form.slug.trim().toLowerCase(), description: form.description.trim(),
    imageUrl: form.imageUrl.trim(), sortOrder: Number(form.sortOrder), isActive: form.isActive };
}

export function categoryPatch(form: CategoryFormValues, original: OwnerCategory): CategoryPatch {
  const next = categoryWrite(form);
  const patch: CategoryPatch = {};
  for (const key of Object.keys(next) as (keyof CategoryWrite)[]) {
    if (next[key] !== (original[key] ?? "")) Object.assign(patch, { [key]: next[key] });
  }
  return patch;
}
