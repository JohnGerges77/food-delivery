import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import { cache } from "react";
import { PublicMenuError, findPublicProduct, getAllPublicCategories, getPublicProducts, selectOffers,
  getPublicRestaurant, localPreviewSlug, validateStorefrontSlug } from "@/services/public-menu";
import { StorefrontClient } from "./StorefrontClient";
import { storefrontCheckoutAvailability } from "@/services/guest-checkout-service";

export type StorefrontPage = "home" | "menu" | "product" | "cart" | "checkout" | "about";

const isBeta = () => process.env.VERCEL_ENV === "production" && process.env.SAVORA_DEPLOYMENT_MODE === "beta";
const storefrontRestaurant = cache(getPublicRestaurant);

function resolveSlug(slug?: string) {
  return slug ? validateStorefrontSlug(slug) : isBeta() ? "savora-beta-demo" : localPreviewSlug();
}

export async function restaurantMetadata(locale: string, slug?: string): Promise<Metadata> {
  try {
    const resolved = resolveSlug(slug);
    if (!resolved) return {};
    const restaurant = await storefrontRestaurant(resolved, locale);
    const title = restaurant.name + " | Savora";
    const description = restaurant.description?.trim() || (locale === "ar"
      ? "تصفّح قائمة المطعم على سافورا."
      : "Browse the restaurant menu on Savora.");
    return { title, description, openGraph: { title, description } };
  } catch (error) {
    if (error instanceof PublicMenuError) return {};
    throw error;
  }
}

export async function StorefrontView({ slug, page, productId }: {
  slug?: string; page: StorefrontPage; productId?: string;
}) {
  const beta = isBeta();
  const locale = await getLocale();
  let resolvedSlug: string | null;
  try { resolvedSlug = resolveSlug(slug); }
  catch (error) {
    if (slug && error instanceof PublicMenuError) notFound();
    throw error;
  }
  if (!resolvedSlug) return <main className="mx-auto max-w-2xl px-6 py-28 text-center text-[color:var(--text)]"><h1 className="text-3xl font-semibold">Storefront unavailable</h1><p className="mt-4 text-[color:var(--text-muted)]">Open a restaurant URL to browse its menu.</p></main>;
  const basePath = slug ? `/r/${resolvedSlug}` : "";
  let restaurant;
  let categories;
  let listing;
  let product;
  let offers;
  try {
    restaurant = await storefrontRestaurant(resolvedSlug, locale);
    const needsMenu = page === "home" || page === "menu" || page === "product";
    [categories, listing, product, offers] = await Promise.all([
      needsMenu ? getAllPublicCategories(resolvedSlug, locale) : Promise.resolve([]),
      page === "home" || page === "menu" ? getPublicProducts(resolvedSlug, 1, { locale }) : Promise.resolve(null),
      page === "product" && productId ? findPublicProduct(resolvedSlug, productId, locale) : Promise.resolve(null),
      page === "home" ? getPublicProducts(resolvedSlug, 1, { isFeatured: true, locale }) : Promise.resolve(null),
    ]);
  } catch (error) {
    if (error instanceof PublicMenuError && error.status === 404) notFound();
    throw error;
  }
  if (page === "product" && !product) notFound();
  const checkoutAvailability = storefrontCheckoutAvailability(beta,
    process.env.SAVORA_BETA_CHECKOUT_ENABLED === "true", restaurant.deliverySettings.deliveryAvailable,
    restaurant.onlineOrderingEnabled, restaurant.checkoutAvailability);
  if (checkoutAvailability === "menu-only" && (page === "cart" || page === "checkout")) {
    redirect(`/${locale}${basePath}/menu`);
  }
  return <StorefrontClient key={resolvedSlug} basePath={basePath} restaurant={restaurant} page={page}
    categories={categories} initialProducts={listing?.products ?? []} offers={selectOffers(offers?.products ?? [])}
    initialPagination={listing?.pagination ?? null} product={product} beta={beta} checkoutAvailability={checkoutAvailability} />;
}
