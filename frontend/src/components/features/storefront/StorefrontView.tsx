import { notFound } from "next/navigation";
import { PublicMenuError, findPublicProduct, getAllPublicCategories, getPublicProducts, selectOffers,
  getPublicRestaurant, localPreviewSlug, validateStorefrontSlug } from "@/services/public-menu";
import { StorefrontClient } from "./StorefrontClient";
import { storefrontCheckoutAvailability } from "@/services/guest-checkout-service";

export type StorefrontPage = "home" | "menu" | "product" | "cart" | "checkout" | "about";

export async function StorefrontView({ slug, page, productId }: {
  slug?: string; page: StorefrontPage; productId?: string;
}) {
  const beta = process.env.VERCEL_ENV === "production" && process.env.SAVORA_DEPLOYMENT_MODE === "beta";
  let resolvedSlug: string | null;
  try { resolvedSlug = slug ? validateStorefrontSlug(slug) : beta ? "savora-beta-demo" : localPreviewSlug(); }
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
    restaurant = await getPublicRestaurant(resolvedSlug);
    const needsMenu = page === "home" || page === "menu" || page === "product";
    [categories, listing, product, offers] = await Promise.all([
      needsMenu ? getAllPublicCategories(resolvedSlug) : Promise.resolve([]),
      page === "home" || page === "menu" ? getPublicProducts(resolvedSlug) : Promise.resolve(null),
      page === "product" && productId ? findPublicProduct(resolvedSlug, productId) : Promise.resolve(null),
      page === "home" ? getPublicProducts(resolvedSlug, 1, { isFeatured: true }) : Promise.resolve(null),
    ]);
  } catch (error) {
    if (error instanceof PublicMenuError && error.status === 404) notFound();
    throw error;
  }
  if (page === "product" && !product) notFound();
  const checkoutAvailability = storefrontCheckoutAvailability(beta,
    process.env.SAVORA_BETA_CHECKOUT_ENABLED === "true", restaurant.deliverySettings.deliveryAvailable);
  return <StorefrontClient key={resolvedSlug} basePath={basePath} restaurant={restaurant} page={page}
    categories={categories} initialProducts={listing?.products ?? []} offers={selectOffers(offers?.products ?? [])}
    initialPagination={listing?.pagination ?? null} product={product} beta={beta} checkoutAvailability={checkoutAvailability} />;
}
