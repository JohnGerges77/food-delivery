import { westernDigits } from "../lib/western-digits.ts";

export type PublicRestaurant = {
  name: string; slug: string; description: string | null; logoUrl: string | null;
  storefrontTheme?: string;
  heroProduct?: PublicProduct | null;
  heroProductSelected?: boolean;
  currency: string; phone: string | null; contactEmail: string | null;
  address: string | null; openingHours: string | null;
  deliverySettings: { deliveryFee: number | null; minimumOrder: number | null;
    estimatedDeliveryTime: string | null; deliveryAvailable: boolean };
  socialLinks: { facebook: string | null; instagram: string | null; whatsapp: string | null };
  branding: { brandName: string | null; primaryColor: string | null };
};
export type PublicCategory = { id: string; name: string; slug: string;
  description: string | null; imageUrl: string | null; sortOrder: number };
export type PublicProduct = { id: string; categoryId: string; name: string; slug: string;
  description: string | null; price: number; oldPrice: number | null;
  imageUrl: string | null; images: string[]; isFeatured: boolean;
  preparationTime: number | null; calories: number | null };
export type PublicPage = { page: number; limit: number; total: number; hasNext: boolean };
export type PublicCategoriesResponse = { categories: PublicCategory[]; pagination: PublicPage };
export type PublicProductsResponse = { currency: string; products: PublicProduct[]; pagination: PublicPage };

export class PublicMenuError extends Error {
  readonly status: number | null;
  constructor(status: number | null, message: string) {
    super(message);
    this.name = "PublicMenuError";
    this.status = status;
  }
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function presentText<T extends string | null | undefined>(value: T): T {
  return (typeof value === "string" ? westernDigits(value) : value) as T;
}
export function validateStorefrontSlug(value: string): string {
  const slug = value.trim().toLowerCase();
  if (!slug || slug.length > 255 || !slugPattern.test(slug)) throw new PublicMenuError(400, "Invalid restaurant address");
  return slug;
}

export function localPreviewSlug(): string | null {
  const value = process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_SAVORA_DEV_RESTAURANT_SLUG : undefined;
  return value ? validateStorefrontSlug(value) : null;
}

function apiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL ||
    (typeof window === "undefined" ? process.env.SAVORA_INTERNAL_API_URL : "");
  if (typeof window !== "undefined" && !value) return "";
  if (!value) throw new PublicMenuError(null, "Menu API is not configured");
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw new PublicMenuError(null, "Menu API URL is invalid"); }
}

async function request<T>(slug: string, suffix = "", params?: URLSearchParams): Promise<T> {
  const url = `${apiBaseUrl()}/api/public/restaurants/${encodeURIComponent(validateStorefrontSlug(slug))}${suffix}${params ? `?${params}` : ""}`;
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(12_000) });
  } catch (error) {
    throw new PublicMenuError(null, error instanceof Error && error.name === "TimeoutError" ? "Menu request timed out" : "Cannot reach menu server");
  }
  if (!response.ok) throw new PublicMenuError(response.status, response.status === 404 ? "Restaurant unavailable" : "Menu request failed");
  try { return await response.json() as T; }
  catch { throw new PublicMenuError(null, "Invalid menu response"); }
}

export async function getPublicRestaurant(slug: string): Promise<PublicRestaurant> {
  const data = await request<{ restaurant: PublicRestaurant }>(slug);
  if (!data?.restaurant || data.restaurant.slug !== validateStorefrontSlug(slug)) throw new PublicMenuError(null, "Invalid restaurant response");
  const restaurant = data.restaurant;
  return { ...restaurant, ...(typeof restaurant.name === "string" ? { name: westernDigits(restaurant.name) } : {}),
    ...(Object.hasOwn(restaurant, "description") ? { description: presentText(restaurant.description) } : {}),
    ...(Object.hasOwn(restaurant, "phone") ? { phone: presentText(restaurant.phone) } : {}),
    ...(Object.hasOwn(restaurant, "address") ? { address: presentText(restaurant.address) } : {}),
    ...(Object.hasOwn(restaurant, "openingHours") ? { openingHours: presentText(restaurant.openingHours) } : {}),
    ...(restaurant.deliverySettings ? { deliverySettings: { ...restaurant.deliverySettings,
      estimatedDeliveryTime: presentText(restaurant.deliverySettings.estimatedDeliveryTime) } } : {}),
    ...(restaurant.branding ? { branding: { ...restaurant.branding,
      brandName: presentText(restaurant.branding.brandName) } } : {}),
    ...(Object.hasOwn(restaurant, "heroProduct") ? { heroProduct: restaurant.heroProduct ?
      presentProduct(restaurant.heroProduct) : restaurant.heroProduct } : {}) };
}
function presentProduct(product: PublicProduct): PublicProduct {
  return { ...product, name: presentText(product.name),
    description: presentText(product.description) };
}
export function getPublicCategories(slug: string, page = 1) {
  return request<PublicCategoriesResponse>(slug, "/categories", new URLSearchParams({ page: String(page), limit: "100" }))
    .then((result) => ({ ...result, categories: result.categories.map((category) => ({ ...category,
      name: presentText(category.name),
      description: presentText(category.description) })) }));
}
export function getPublicProducts(slug: string, page = 1, options: { categoryId?: string; isFeatured?: boolean; sort?: string } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: "100" });
  if (options.categoryId) params.set("categoryId", options.categoryId);
  if (options.isFeatured !== undefined) params.set("isFeatured", String(options.isFeatured));
  if (options.sort) params.set("sort", options.sort);
  return request<PublicProductsResponse>(slug, "/products", params)
    .then((result) => ({ ...result, products: result.products.map(presentProduct) }));
}

export async function getAllPublicCategories(slug: string): Promise<PublicCategory[]> {
  const categories: PublicCategory[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await getPublicCategories(slug, page);
    categories.push(...result.categories);
    if (!result.pagination.hasNext) return categories;
  }
  throw new PublicMenuError(null, "Category list exceeds the supported preview size");
}

export async function findPublicProduct(slug: string, id: string): Promise<PublicProduct | null> {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
  for (let page = 1; page <= 10; page++) {
    const result = await getPublicProducts(slug, page);
    const found = result.products.find((product) => product.id === id);
    if (found) return found;
    if (!result.pagination.hasNext) return null;
  }
  throw new PublicMenuError(null, "Product list exceeds the supported preview size");
}
