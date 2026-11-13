"use client";

import { useEffect, type ComponentType } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { publicMoney } from "@/lib/public-menu-presentation";
import type { PublicCategory, PublicPage, PublicProduct, PublicRestaurant } from "@/services/public-menu";
import { useCartStore } from "@/store/cart-store";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import Footer from "@/components/layout/Footer";
import { HeroSection } from "@/components/features/landing/HeroSection";
import BestItems from "@/components/features/landing/Bestitems";
import { FeaturedProducts } from "@/components/features/landing/FeaturedProducts";
import WhyChoose from "@/components/features/landing/WhyChoose";
import ContactSection from "@/components/features/landing/ContactSection";
import { MenuOrderingPage } from "@/components/features/menu/MenuOrderingPage";
import { CartOrderingPage } from "@/components/features/cart/CartOrderingPage";
import { CheckoutOrderingPage } from "@/components/features/checkout/CheckoutOrderingPage";
import { ProductImageGallery } from "./ProductImageGallery";
import { StorefrontProvider, useStorefront } from "./StorefrontContext";
import type { StorefrontPage } from "./StorefrontView";
import { resolveStorefrontTheme, type StorefrontThemeId } from "@/lib/storefront-theme";
import { AquaAbout, AquaFooter, AquaHome, AquaMenu, AquaNavbar, AquaProduct } from "./aqua/AquaStorefront";
import aquaStyles from "./aqua/AquaStorefront.module.css";
import { CafeAbout, CafeFooter, CafeHome, CafeMenu, CafeNavbar, CafeProduct } from "./cafe/CafeStorefront";
import cafeStyles from "./cafe/CafeStorefront.module.css";
import { LuxuryAbout, LuxuryFooter, LuxuryHome, LuxuryMenu, LuxuryNavbar, LuxuryProduct } from "./luxury/LuxuryStorefront";
import luxuryStyles from "./luxury/LuxuryStorefront.module.css";

type Props = {
  basePath: string;
  restaurant: PublicRestaurant;
  page: StorefrontPage;
  categories: PublicCategory[];
  initialProducts: PublicProduct[];
  initialPagination: PublicPage | null;
  product: PublicProduct | null;
};

function ProductPage({ product }: { product: PublicProduct }) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { restaurant, categories, href } = useStorefront();
  const addItem = useCartStore((state) => state.addPublicItem);
  const category = categories.find((entry) => entry.id === product.categoryId);
  return <main className="min-h-screen overflow-hidden bg-[color:var(--background)] px-4 py-16 text-[color:var(--text)] sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <Link className="text-sm font-semibold text-[color:var(--primary-light)] hover:underline" href={href("/menu")}>{isArabic ? "العودة للمنيو" : "Back to menu"}</Link>
      <article className="mt-8 grid gap-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.025)_60%,rgba(255,122,0,.05))] shadow-[0_30px_90px_rgba(0,0,0,.35)] lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden"><ProductImageGallery product={product} sizes="(min-width: 1024px) 50vw, 100vw" /></div>
        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
          {category && <p className="text-xs font-semibold uppercase tracking-[.22em] text-[color:var(--gold)]">{category.name}</p>}
          <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">{product.name}</h1>
          {product.description && <p className="mt-6 text-base leading-8 text-[color:var(--text-muted)]">{product.description}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-4"><strong className="text-3xl text-[color:var(--primary-light)]">{publicMoney(product.price, restaurant.currency, locale)}</strong>{product.oldPrice !== null && product.oldPrice > product.price && <span className="text-[color:var(--text-muted)] line-through">{publicMoney(product.oldPrice, restaurant.currency, locale)}</span>}</div>
          {product.preparationTime !== null && <p className="mt-5 text-sm text-[color:var(--text-muted)]">{isArabic ? "وقت التحضير" : "Preparation time"}: {product.preparationTime} {isArabic ? "دقيقة" : "min"}</p>}
          <button className="mt-9 min-h-13 self-start rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-8 font-bold text-[color:var(--background)] shadow-[0_20px_56px_rgba(255,122,0,.3)] transition-transform hover:-translate-y-0.5" onClick={() => addItem(restaurant.slug, product)} type="button">{isArabic ? "أضف إلى السلة" : "Add to cart"}</button>
        </div>
      </article>
    </div>
  </main>;
}

function AboutPage() {
  const { restaurant } = useStorefront();
  return <main className="min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]">
    <WhyChoose restaurant={restaurant} />
    <ContactSection />
  </main>;
}

function ClassicHome({ restaurant, initialProducts }: Pick<Props, "restaurant" | "initialProducts">) {
  return <main><HeroSection restaurant={restaurant} /><BestItems products={initialProducts} /><FeaturedProducts products={initialProducts} /><WhyChoose restaurant={restaurant} /><ContactSection /></main>;
}

// Each shipped theme supplies public presentation slots. Ordering state and API services
// stay outside the registry; Cart and Checkout are intentionally shared below.
type StorefrontTheme = {
  Navbar: ComponentType;
  Footer: ComponentType;
  Home: ComponentType<Pick<Props, "restaurant" | "initialProducts">>;
  Menu: ComponentType<Pick<Props, "initialProducts" | "initialPagination">>;
  Product: ComponentType<{ product: PublicProduct }>;
  About: ComponentType;
};

const storefrontThemes: Record<StorefrontThemeId, StorefrontTheme> = {
  "savora-classic": {
    Navbar: PublicNavbar,
    Footer,
    Home: ClassicHome,
    Menu: MenuOrderingPage,
    Product: ProductPage,
    About: AboutPage,
  },
  "savora-aqua": {
    Navbar: AquaNavbar,
    Footer: AquaFooter,
    Home: AquaHome,
    Menu: AquaMenu,
    Product: AquaProduct,
    About: AquaAbout,
  },
  "savora-cafe": {
    Navbar: CafeNavbar,
    Footer: CafeFooter,
    Home: CafeHome,
    Menu: CafeMenu,
    Product: CafeProduct,
    About: CafeAbout,
  },
  "savora-luxury": {
    Navbar: LuxuryNavbar,
    Footer: LuxuryFooter,
    Home: LuxuryHome,
    Menu: LuxuryMenu,
    Product: LuxuryProduct,
    About: LuxuryAbout,
  },
};

export function StorefrontClient({ basePath, restaurant, page, categories, initialProducts, initialPagination, product }: Props) {
  const setTenant = useCartStore((state) => state.setTenant);
  useEffect(() => { setTenant(restaurant.slug); }, [restaurant.slug, setTenant]);
  const themeId = resolveStorefrontTheme(restaurant);
  const theme = storefrontThemes[themeId];
  return <StorefrontProvider restaurant={restaurant} categories={categories} basePath={basePath}>
    <div data-storefront-theme={themeId} data-storefront-page={page} className={`min-h-screen bg-[color:var(--sf-background)] text-[color:var(--sf-text)] ${themeId === "savora-aqua" ? aquaStyles.root : themeId === "savora-cafe" ? cafeStyles.root : themeId === "savora-luxury" ? luxuryStyles.root : ""}`}>
      <theme.Navbar />
      {page === "home" && <theme.Home restaurant={restaurant} initialProducts={initialProducts} />}
      {page === "menu" && <theme.Menu initialProducts={initialProducts} initialPagination={initialPagination} />}
      {page === "product" && product && <theme.Product product={product} />}
      {page === "cart" && <CartOrderingPage deliveryFee={restaurant.deliverySettings.deliveryFee} currency={restaurant.currency} slug={restaurant.slug} />}
      {page === "checkout" && <CheckoutOrderingPage key={restaurant.slug} deliveryFee={restaurant.deliverySettings.deliveryFee} currency={restaurant.currency} slug={restaurant.slug} />}
      {page === "about" && <theme.About />}
      <theme.Footer />
    </div>
  </StorefrontProvider>;
}
