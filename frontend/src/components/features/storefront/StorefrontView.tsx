import { notFound } from "next/navigation";
import { PublicMenuError, findPublicProduct, getAllPublicCategories, getPublicProducts,
  getPublicRestaurant, localPreviewSlug, validateStorefrontSlug } from "@/services/public-menu";
import { StorefrontClient } from "./StorefrontClient";

export type StorefrontPage = "home" | "menu" | "product" | "cart" | "checkout" | "about";

export async function StorefrontView({ slug, page, productId }: {
  slug?: string; page: StorefrontPage; productId?: string;
}) {
  let resolvedSlug: string | null;
  try { resolvedSlug = slug ? validateStorefrontSlug(slug) : localPreviewSlug(); }
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
  try {
    restaurant = await getPublicRestaurant(resolvedSlug);
    const needsMenu = page === "home" || page === "menu" || page === "product";
    [categories, listing, product] = await Promise.all([
      needsMenu ? getAllPublicCategories(resolvedSlug) : Promise.resolve([]),
      page === "home" || page === "menu" ? getPublicProducts(resolvedSlug) : Promise.resolve(null),
      page === "product" && productId ? findPublicProduct(resolvedSlug, productId) : Promise.resolve(null),
    ]);
  } catch (error) {
    if (error instanceof PublicMenuError && error.status === 404) notFound();
    throw error;
  }
  if (page === "product" && !product) notFound();
  return <StorefrontClient key={resolvedSlug} basePath={basePath} restaurant={restaurant} page={page}
    categories={categories} initialProducts={listing?.products ?? []}
    initialPagination={listing?.pagination ?? null} product={product} />;
}
