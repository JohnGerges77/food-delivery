import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import { cache, Suspense, type ReactNode } from "react";
import { PublicMenuError, getAllPublicCategories, getPublicProductDetail, getPublicProducts,
  getPublicRestaurant, localPreviewSlug, validateStorefrontSlug, selectOffers } from "@/services/public-menu";
import { createPublicCatalogCache } from "@/services/public-catalog-cache";
import { storefrontCheckoutAvailability } from "@/services/guest-checkout-service";
import { resolveStorefrontTheme } from "@/lib/storefront-theme";
import { HeroSection } from "@/components/features/landing/HeroSection";
import { StorefrontFrame, StorefrontPageScope } from "./StorefrontFrame";
import { StorefrontContent } from "./StorefrontContent";

export type StorefrontPage = "home" | "menu" | "product" | "cart" | "checkout" | "about";

const isBeta = () => process.env.VERCEL_ENV === "production" && process.env.SAVORA_DEPLOYMENT_MODE === "beta";
const storefrontRestaurant = cache(getPublicRestaurant);
const readCatalog = createPublicCatalogCache();

function resolveSlug(slug?: string) {
  return slug ? validateStorefrontSlug(slug) : isBeta() ? "savora-beta-demo" : localPreviewSlug();
}

function unavailable(error: unknown): never {
  if (error instanceof PublicMenuError && error.status === 404) notFound();
  throw error;
}

function getStorefrontRestaurant(slug: string, locale: string) {
  return storefrontRestaurant(slug, locale).catch(unavailable);
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

function resolveRouteSlug(slug?: string) {
  try {
    return resolveSlug(slug);
  } catch (error) {
    if (slug && error instanceof PublicMenuError) notFound();
    throw error;
  }
}

export async function StorefrontLayout({ slug, children }: { slug?: string; children: ReactNode }) {
  const resolved = resolveRouteSlug(slug);
  if (!resolved) return children;
  const restaurant = await getStorefrontRestaurant(resolved, await getLocale());
  return <StorefrontFrame initialRestaurant={restaurant} basePath={slug ? `/r/${resolved}` : ""}>{children}</StorefrontFrame>;
}

function loadMenu(slug: string, locale: string) {
  return Promise.all([
    readCatalog([slug, locale, "categories"], () => getAllPublicCategories(slug, locale)),
    readCatalog([slug, locale, "products"], () => getPublicProducts(slug, 1, { locale })),
  ]);
}

async function CatalogPage({ page, restaurant, basePath, menu, featured }: {
  page: "home" | "menu";
  restaurant: Awaited<ReturnType<typeof getStorefrontRestaurant>>;
  basePath: string;
  menu: ReturnType<typeof loadMenu>;
  featured: ReturnType<typeof getPublicProducts> | null;
}) {
  const [[categories, listing], offers] = await Promise.all([menu, featured]).catch(unavailable);
  return <StorefrontPageScope restaurant={restaurant} basePath={basePath} categories={categories}>
    {page === "home"
      ? <StorefrontContent page="home" initialProducts={listing.products} offers={selectOffers(offers?.products ?? [])} />
      : <StorefrontContent page="menu" initialProducts={listing.products} initialPagination={listing.pagination} />}
  </StorefrontPageScope>;
}

export async function StorefrontLoading() {
  const ar = (await getLocale()) === "ar";
  return <div role="status" aria-busy="true" className="min-h-[45vh] px-4 py-16 text-[color:var(--sf-text-muted)] sm:px-8">
    <div className="mx-auto max-w-7xl">
      <span className="block w-fit border-b-2 border-[color:var(--sf-primary)] pb-2 text-sm">{ar ? "جاري التحميل…" : "Loading…"}</span>
    </div>
  </div>;
}

export async function StorefrontView({ slug, page, productId }: {
  slug?: string; page: StorefrontPage; productId?: string;
}) {
  const resolved = resolveRouteSlug(slug);
  if (!resolved) return <main className="mx-auto max-w-2xl px-6 py-28 text-center text-[color:var(--text)]"><h1 className="text-3xl font-semibold">Storefront unavailable</h1><p className="mt-4 text-[color:var(--text-muted)]">Open a restaurant URL to browse its menu.</p></main>;
  const basePath = slug ? `/r/${resolved}` : "";
  const locale = await getLocale();
  const restaurantRequest = getStorefrontRestaurant(resolved, locale);
  const menu = page === "home" || page === "menu" ? loadMenu(resolved, locale) : null;
  const featured = page === "home" ? readCatalog([resolved, locale, "featured"],
    () => getPublicProducts(resolved, 1, { locale, isFeatured: true, limit: 5 })) : null;
  const detail = page === "product" && productId ? readCatalog([resolved, locale, "product", productId.toLowerCase()],
    () => getPublicProductDetail(resolved, productId, locale)) : null;
  // These requests start in parallel. A failed live tenant check can end this render early.
  void menu?.catch(() => {});
  void featured?.catch(() => {});
  void detail?.catch(() => {});
  const restaurant = await restaurantRequest;

  if (page === "home" && menu && resolveStorefrontTheme(restaurant) === "savora-classic") {
    return <main>
      <StorefrontPageScope restaurant={restaurant} basePath={basePath}><HeroSection restaurant={restaurant} /></StorefrontPageScope>
      <Suspense fallback={<StorefrontLoading />}>
        <CatalogPage page={page} restaurant={restaurant} basePath={basePath} menu={menu} featured={featured} />
      </Suspense>
    </main>;
  }
  if (menu && (page === "home" || page === "menu")) {
    return await CatalogPage({ page, restaurant, basePath, menu, featured });
  }
  if (page === "product") {
    if (!detail) notFound();
    const { product, category } = await detail.catch(unavailable);
    return <StorefrontPageScope restaurant={restaurant} basePath={basePath} categories={[category]}><StorefrontContent page={page} product={product} /></StorefrontPageScope>;
  }

  if (page === "cart" || page === "checkout") {
    const beta = isBeta();
    const checkoutAvailability = storefrontCheckoutAvailability(beta,
      process.env.SAVORA_BETA_CHECKOUT_ENABLED === "true", restaurant.deliverySettings.deliveryAvailable,
      restaurant.onlineOrderingEnabled, restaurant.checkoutAvailability);
    if (checkoutAvailability === "menu-only") redirect(`/${locale}${basePath}/menu`);
    return <StorefrontPageScope restaurant={restaurant} basePath={basePath}>
      <StorefrontContent page={page} beta={beta} checkoutAvailability={checkoutAvailability} />
    </StorefrontPageScope>;
  }
  return <StorefrontPageScope restaurant={restaurant} basePath={basePath}><StorefrontContent page="about" /></StorefrontPageScope>;
}
