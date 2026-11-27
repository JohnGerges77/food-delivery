"use client";
import { ProductPurchase } from "./ProductPurchase";
import { useLocale } from "next-intl";
import { StorefrontLink as Link } from "@/components/features/storefront/StorefrontLink";
import { productDisplayPrice, publicMoney } from "@/lib/public-menu-presentation";
import type { PublicProduct } from "@/services/public-menu";
import BestItems from "@/components/features/landing/Bestitems";
import { FeaturedProducts } from "@/components/features/landing/FeaturedProducts";
import WhyChoose from "@/components/features/landing/WhyChoose";
import ContactSection from "@/components/features/landing/ContactSection";
import { ProductImageGallery } from "./ProductImageGallery";
import { ProductMetadata } from "./ProductMetadata";
import { useStorefront } from "./StorefrontContext";

export function ClassicProduct({ product }: { product: PublicProduct }) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { restaurant, categories, href } = useStorefront();
  const category = categories.find((entry) => entry.id === product.categoryId);
  return <main className="min-h-screen overflow-hidden bg-[color:var(--background)] px-4 py-16 text-[color:var(--text)] sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <Link className="text-sm font-semibold text-[color:var(--primary-light)] hover:underline" href={href("/menu")}>{isArabic ? "العودة للمنيو" : "Back to menu"}</Link>
      <article className="mt-8 grid gap-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.025)_60%,color-mix(in_srgb,var(--sf-primary)_5%,transparent))] shadow-[0_30px_90px_rgba(0,0,0,.35)] lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden"><ProductImageGallery product={product} sizes="(min-width: 1024px) 50vw, 100vw" /></div>
        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
          {category && <p className="text-xs font-semibold uppercase tracking-[.22em] text-[color:var(--gold)]">{category.name}</p>}
          <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">{product.name}</h1>
          {product.description && <p className="mt-6 whitespace-pre-line text-base leading-8 text-[color:var(--text-muted)]">{product.description}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-4"><strong className="text-3xl text-[color:var(--primary-light)]">{productDisplayPrice(product, restaurant.currency, locale)}</strong>{!product.variants?.length && product.oldPrice !== null && product.oldPrice > product.price && <span className="text-[color:var(--text-muted)] line-through">{publicMoney(product.oldPrice, restaurant.currency, locale)}</span>}</div>
          <ProductMetadata product={product} locale={locale} />
          <ProductPurchase product={product} buttonClassName={"mt-9 min-h-13 rounded-full bg-[color:var(--primary)] px-8 font-bold text-[color:var(--sf-on-primary)]"} />
        </div>
      </article>
    </div>
  </main>;
}

export function ClassicAbout() {
  const { restaurant } = useStorefront();
  return <main className="min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]">
    <WhyChoose restaurant={restaurant} />
    <ContactSection />
  </main>;
}

export function ClassicHomeContent({ initialProducts, offers }: { initialProducts: PublicProduct[]; offers: PublicProduct[] }) {
  const { restaurant } = useStorefront();
  return <><BestItems products={offers} /><FeaturedProducts products={initialProducts} /><WhyChoose restaurant={restaurant} /><ContactSection /></>;
}
