import { ApiError, apiRequest } from "./api-client.ts";
import { isObjectId, isRecord, parsePagination, validOwnerImageUrl, validSlug, type OwnerPagination } from "./owner-catalog-common.ts";
import type { OwnerCategory } from "./owner-categories-service.ts";

export interface OwnerProduct {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  description: string | null;
  price: number;
  oldPrice: number | null;
  imageUrl: string | null;
  images: string[];
  isAvailable: boolean;
  isFeatured: boolean;
  preparationTime: number | null;
  calories: number | null;
}

export interface ProductFormValues {
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  price: string;
  oldPrice: string;
  imageUrl: string;
  images: string;
  isAvailable: boolean;
  isFeatured: boolean;
  preparationTime: string;
  calories: string;
}

export type ProductWrite = Pick<OwnerProduct, "name" | "slug" | "categoryId" | "description" | "price" | "oldPrice" | "imageUrl" | "images" | "isAvailable" | "isFeatured" | "preparationTime" | "calories">;
export type ProductPatch = Partial<ProductWrite>;
export type ProductSort = "name" | "-name" | "price" | "-price" | "createdAt" | "-createdAt";
export interface ProductListOptions {
  page?: number;
  limit?: number;
  sort?: ProductSort;
  categoryId?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
}

function nullableNumber(value: unknown) { return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0); }
function nullableString(value: unknown) { return value === null || typeof value === "string"; }

export function parseOwnerProduct(value: unknown): OwnerProduct {
  if (!isRecord(value) || ![value.id, value.name, value.slug, value.categoryId].every((item) => typeof item === "string" && item.length > 0) ||
      !nullableString(value.description) || !nullableString(value.imageUrl) || !nullableNumber(value.price) ||
      value.price === null || !nullableNumber(value.oldPrice) || !nullableNumber(value.preparationTime) || !nullableNumber(value.calories) ||
      !Array.isArray(value.images) || !value.images.every((image) => typeof image === "string") ||
      typeof value.isAvailable !== "boolean" || typeof value.isFeatured !== "boolean") {
    throw new ApiError(null, "Invalid server response");
  }
  return value as unknown as OwnerProduct;
}

function parseOne(value: unknown): OwnerProduct {
  if (!isRecord(value)) throw new ApiError(null, "Invalid server response");
  return parseOwnerProduct(value.product);
}

export async function listOwnerProducts(options: ProductListOptions = {}):
  Promise<{ products: OwnerProduct[]; pagination: OwnerPagination }> {
  const params = new URLSearchParams({ page: String(options.page ?? 1), limit: String(options.limit ?? 12), sort: options.sort ?? "-createdAt" });
  if (options.categoryId) params.set("categoryId", options.categoryId);
  if (options.isAvailable !== undefined) params.set("isAvailable", String(options.isAvailable));
  if (options.isFeatured !== undefined) params.set("isFeatured", String(options.isFeatured));
  const response = await apiRequest<unknown>(`/api/owner/products?${params}`);
  if (!isRecord(response) || !Array.isArray(response.products)) throw new ApiError(null, "Invalid server response");
  return { products: response.products.map(parseOwnerProduct), pagination: parsePagination(response.pagination) };
}

export async function getOwnerProduct(id: string): Promise<OwnerProduct> {
  return parseOne(await apiRequest<unknown>(`/api/owner/products/${encodeURIComponent(id)}`));
}

export async function createOwnerProduct(body: ProductWrite): Promise<OwnerProduct> {
  return parseOne(await apiRequest<unknown>("/api/owner/products", { method: "POST", body, csrf: "session" }));
}

export async function patchOwnerProduct(id: string, body: ProductPatch): Promise<OwnerProduct> {
  return parseOne(await apiRequest<unknown>(`/api/owner/products/${encodeURIComponent(id)}`, { method: "PATCH", body, csrf: "session" }));
}

export async function deleteOwnerProduct(id: string): Promise<void> {
  await apiRequest<void>(`/api/owner/products/${encodeURIComponent(id)}`, { method: "DELETE", csrf: "session" });
}

export function productToForm(product?: OwnerProduct): ProductFormValues {
  return { name: product?.name ?? "", slug: product?.slug ?? "", categoryId: product?.categoryId ?? "",
    description: product?.description ?? "", price: product?.price.toString() ?? "",
    oldPrice: product?.oldPrice?.toString() ?? "", imageUrl: product?.imageUrl ?? "",
    images: product?.images.join("\n") ?? "", isAvailable: product?.isAvailable ?? true,
    isFeatured: product?.isFeatured ?? false, preparationTime: product?.preparationTime?.toString() ?? "",
    calories: product?.calories?.toString() ?? "" };
}

export function currencyDigits(currency: string): number {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  if (digits === undefined) throw new Error("Currency precision unavailable");
  return digits;
}

export function formatOwnerPrice(value: number, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "currency", currency }).format(value);
}

function validMoneyText(value: string, digits: number): boolean {
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`);
  return pattern.test(value) && Number(value) <= 1_000_000 && Number.isFinite(Number(value));
}

export function validateProductForm(form: ProductFormValues, categories: OwnerCategory[], currency: string):
  Partial<Record<keyof ProductFormValues, string>> {
  const errors: Partial<Record<keyof ProductFormValues, string>> = {};
  if (!form.name.trim() || form.name.length > 120) errors.name = "Enter a name of 1–120 characters.";
  if (!validSlug(form.slug.trim().toLowerCase())) errors.slug = "Use lowercase letters, numbers and single hyphens (max 120).";
  if (!isObjectId(form.categoryId) || !categories.some((item) => item.id === form.categoryId)) errors.categoryId = "Select a current category.";
  if (form.description.length > 2048) errors.description = "Use 2048 characters or fewer.";
  const digits = currencyDigits(currency);
  if (!validMoneyText(form.price.trim(), digits)) errors.price = `Enter 0–1,000,000 with up to ${digits} decimal places.`;
  if (form.oldPrice.trim() && !validMoneyText(form.oldPrice.trim(), digits)) errors.oldPrice = `Enter 0–1,000,000 with up to ${digits} decimal places.`;
  if (form.imageUrl.length > 2048 || !validOwnerImageUrl(form.imageUrl.trim())) errors.imageUrl = "Enter a root-relative path or HTTP(S) URL.";
  const images = form.images.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (images.length > 10 || images.some((item) => item.length > 2048 || !validOwnerImageUrl(item))) errors.images = "Use at most 10 valid image paths or URLs, one per line.";
  if (form.preparationTime.trim() && (!/^\d+$/.test(form.preparationTime.trim()) || Number(form.preparationTime) > 10_080)) errors.preparationTime = "Enter a whole number from 0 to 10,080.";
  if (form.calories.trim() && (!/^\d+(?:\.\d+)?$/.test(form.calories.trim()) || Number(form.calories) > 100_000)) errors.calories = "Enter a number from 0 to 100,000.";
  return errors;
}

export function productWrite(form: ProductFormValues, categories: OwnerCategory[], currency: string): ProductWrite {
  if (Object.keys(validateProductForm(form, categories, currency)).length) throw new Error("Invalid product form");
  return { name: form.name.trim(), slug: form.slug.trim().toLowerCase(), categoryId: form.categoryId,
    description: form.description.trim(), price: Number(form.price.trim()),
    oldPrice: form.oldPrice.trim() ? Number(form.oldPrice.trim()) : null,
    imageUrl: form.imageUrl.trim(), images: form.images.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    isAvailable: form.isAvailable, isFeatured: form.isFeatured,
    preparationTime: form.preparationTime.trim() ? Number(form.preparationTime.trim()) : null,
    calories: form.calories.trim() ? Number(form.calories.trim()) : null };
}

export function productPatch(form: ProductFormValues, original: OwnerProduct, categories: OwnerCategory[], currency: string): ProductPatch {
  const next = productWrite(form, categories, currency);
  const patch: ProductPatch = {};
  for (const key of Object.keys(next) as (keyof ProductWrite)[]) {
    if (key === "images" ? JSON.stringify(next.images) !== JSON.stringify(original.images) : next[key] !== (original[key] ?? (typeof next[key] === "string" ? "" : null))) {
      Object.assign(patch, { [key]: next[key] });
    }
  }
  return patch;
}
