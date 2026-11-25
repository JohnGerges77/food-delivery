"use client";

import { useLocale } from "next-intl";
import type { PublicProduct } from "@/services/public-menu";
import { StorefrontProductCard } from "@/components/features/storefront/StorefrontProductCard";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";

export default function BestItems({ products }: { products: PublicProduct[] }) {
  const isArabic = useLocale() === "ar";
  const { categories } = useStorefront();
  const visible = products.filter((product) => product.isFeatured).slice(0, 5);
  if (!visible.length) return null;
  return <section className="relative isolate overflow-hidden bg-[color:var(--background)] px-4 py-20 text-[color:var(--text)] sm:px-6 lg:px-8">
    <div className="absolute left-1/2 top-10 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.16),transparent_66%)] blur-3xl" />
    <div className="absolute bottom-0 right-[-12rem] -z-10 size-[28rem] rounded-full bg-[color:var(--primary)]/10 blur-3xl" />
    <div className="mx-auto max-w-7xl">
      <div className="mx-auto max-w-3xl text-center"><div className="mb-5 flex items-center justify-center gap-4 text-xs font-semibold tracking-[0.24em] text-[color:var(--primary-light)] uppercase"><span className="h-px w-10 bg-[color:var(--primary)]/60" />{isArabic ? "من المنيو" : "From the Menu"}<span className="h-px w-10 bg-[color:var(--primary)]/60" /></div>
        <h2 className="text-4xl font-semibold text-balance text-[color:var(--text)] sm:text-5xl lg:text-6xl">{isArabic ? "العروض" : "Offers"}</h2>
      </div>
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map((item) => <StorefrontProductCard product={item} key={item.id}
        categoryName={categories.find((category) => category.id === item.categoryId)?.name} />)}</div>
    </div>
  </section>;
}
