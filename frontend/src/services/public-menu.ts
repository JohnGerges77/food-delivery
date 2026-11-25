import { westernDigits } from "../lib/western-digits.ts";
import { demoCatalogText } from "../lib/demo-catalog-text.ts";
import type { CheckoutAvailability } from "./guest-checkout-service.ts";

export type PublicRestaurant = {
  name: string; slug: string; description: string | null; logoUrl: string | null; aboutImageUrl?: string | null;
  storefrontTheme?: string;
  heroImageUrl?: string | null;
  onlineOrderingEnabled?: boolean;
  checkoutAvailability?: CheckoutAvailability;
  heroProduct?: PublicProduct | null;
  heroProductSelected?: boolean;
  whatsappOrderingAvailable?: boolean;
  currency: string; phone: string | null; contactEmail: string | null;
  address: string | null; openingHours: string | null;
  deliverySettings: { deliveryFee: number | null; minimumOrder: number | null;
    estimatedDeliveryTime: string | null; deliveryAvailable: boolean };
  socialLinks: { facebook: string | null; instagram: string | null; whatsapp: string | null };
  branding: { brandName: string | null; primaryColor: string | null };
};
export type PublicCategory = { id: string; name: string; slug: string;
  description: string | null; imageUrl: string | null; sortOrder: number };
export type ProductVariant = { id: string; name: string; price: number; isAvailable: boolean; sortOrder: number };
export type PublicProduct = { id: string; categoryId: string; name: string; slug: string; variants?: ProductVariant[]; startingPrice?: number | null;
  description: string | null; price: number; oldPrice: number | null;
  imageUrl: string | null; images: string[]; isFeatured: boolean;
  preparationTime: number | null; calories: number | null };
export type PublicPage = { page: number; limit: number; total: number; hasNext: boolean };
export type PublicCategoriesResponse = { categories: PublicCategory[]; pagination: PublicPage };
export type PublicProductsResponse = { currency: string; products: PublicProduct[]; pagination: PublicPage };

export function selectOffers(products: PublicProduct[]): PublicProduct[] {
  return products.filter((product) => product.isFeatured).slice(0, 5);
}

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

export async function getPublicRestaurant(slug: string, locale = "en"): Promise<PublicRestaurant> {
  const data = await request<{ restaurant: PublicRestaurant }>(slug);
  if (!data?.restaurant || data.restaurant.slug !== validateStorefrontSlug(slug)) throw new PublicMenuError(null, "Invalid restaurant response");
  const restaurant = data.restaurant;
  return { ...restaurant, ...(typeof restaurant.name === "string" ? { name: westernDigits(restaurant.name) } : {}),
    ...(Object.hasOwn(restaurant, "description") ? { description: presentText(restaurant.description) } : {}),
    ...(Object.hasOwn(restaurant, "phone") ? { phone: presentText(restaurant.phone?.trim() || null) } : {}),
    ...(Object.hasOwn(restaurant, "contactEmail") ? { contactEmail: restaurant.contactEmail?.trim() || null } : {}),
    ...(Object.hasOwn(restaurant, "address") ? { address: presentText(restaurant.address?.trim() || null) } : {}),
    ...(Object.hasOwn(restaurant, "openingHours") ? { openingHours: presentText(restaurant.openingHours) } : {}),
    ...(restaurant.deliverySettings ? { deliverySettings: { ...restaurant.deliverySettings,
      estimatedDeliveryTime: presentText(restaurant.deliverySettings.estimatedDeliveryTime) } } : {}),
    ...(restaurant.branding ? { branding: { ...restaurant.branding,
      brandName: presentText(restaurant.branding.brandName) } } : {}),
    ...(Object.hasOwn(restaurant, "heroProduct") ? { heroProduct: restaurant.heroProduct ?
      presentProduct(restaurant.heroProduct, demoCatalogText(restaurant.slug, locale)) : restaurant.heroProduct } : {}) };
}
function presentProduct(product: PublicProduct, text: ReturnType<typeof demoCatalogText>): PublicProduct {
  const translation = text?.product(product.slug);
  return { ...product, name: translation?.name ?? presentText(product.name),
    description: translation?.description ?? presentText(product.description),
    ...(translation && product.variants ? {
      variants: product.variants.map((variant) => ({ ...variant, name: text?.variant(variant.name) ?? variant.name })),
    } : {}),
  };
}
export function getPublicCategories(slug: string, page = 1, locale = "en") {
  return request<PublicCategoriesResponse>(slug, "/categories", new URLSearchParams({ page: String(page), limit: "100" }))
    .then((result) => {
      const text = demoCatalogText(validateStorefrontSlug(slug), locale);
      return { ...result, categories: result.categories.map((category) => ({ ...category,
        name: text?.category(category.slug) ?? presentText(category.name),
        description: presentText(category.description) })) };
    });
}
export function getPublicProducts(slug: string, page = 1, options: { categoryId?: string; isFeatured?: boolean; sort?: string; locale?: string } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: "100" });
  if (options.categoryId) params.set("categoryId", options.categoryId);
  if (options.isFeatured !== undefined) params.set("isFeatured", String(options.isFeatured));
  if (options.sort) params.set("sort", options.sort);
  return request<PublicProductsResponse>(slug, "/products", params)
    .then((result) => {
      const text = demoCatalogText(validateStorefrontSlug(slug), options.locale ?? "en");
      return { ...result, products: result.products.map((product) => presentProduct(product, text)) };
    });
}

export async function getAllPublicCategories(slug: string, locale = "en"): Promise<PublicCategory[]> {
  const categories: PublicCategory[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await getPublicCategories(slug, page, locale);
    categories.push(...result.categories);
    if (!result.pagination.hasNext) return categories;
  }
  throw new PublicMenuError(null, "Category list exceeds the supported preview size");
}

export async function findPublicProduct(slug: string, id: string, locale = "en"): Promise<PublicProduct | null> {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
  for (let page = 1; page <= 10; page++) {
    const result = await getPublicProducts(slug, page, { locale });
    const found = result.products.find((product) => product.id === id.toLowerCase());
    if (found) return found;
    if (!result.pagination.hasNext) return null;
  }
  throw new PublicMenuError(null, "Product list exceeds the supported preview size");
}
