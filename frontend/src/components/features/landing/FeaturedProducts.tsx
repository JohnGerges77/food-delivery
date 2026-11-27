"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { StorefrontLink as Link } from "@/components/features/storefront/StorefrontLink";
import { routes } from "@/lib/routes";
import type { PublicProduct } from "@/services/public-menu";
import { StorefrontProductCard } from "@/components/features/storefront/StorefrontProductCard";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";

export function FeaturedProducts({ products }: { products: PublicProduct[] }) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { categories, href } = useStorefront();
  const [activeCategory, setActiveCategory] = useState("");
  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const displayed = products.filter((item) => categoryNames.has(item.categoryId) &&
    (!activeCategory || item.categoryId === activeCategory)).slice(0, 6);

  return <section className="relative isolate overflow-hidden bg-[color:var(--background)] px-4 py-20 text-[color:var(--text)] sm:px-6 lg:px-8">
    <div className="absolute left-[-10rem] top-20 -z-10 size-[26rem] rounded-full bg-[color:var(--primary)]/10 blur-3xl" />
    <div className="absolute bottom-0 right-0 -z-10 size-[34rem] translate-x-1/3 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--sf-primary)_16%,transparent),transparent_68%)] blur-3xl" />
    <div className="mx-auto max-w-7xl">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-5 flex items-center justify-center gap-4 text-xs font-semibold tracking-[0.24em] text-[color:var(--primary-light)] uppercase"><span className="h-px w-10 bg-[color:var(--primary)]/60" />{isArabic ? "قائمتنا" : "Our Menu"}<span className="h-px w-10 bg-[color:var(--primary)]/60" /></div>
        <h2 className="text-4xl font-semibold text-balance text-[color:var(--text)] sm:text-5xl lg:text-6xl">{isArabic ? "تعرّف على المنيو" : "Discover the Menu"}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">{isArabic ? "لمحة من الأطباق المتاحة لدى المطعم." : "A preview of this restaurant's available dishes."}</p>
      </div>
      <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2 rounded-[2rem] border border-white/10 bg-white/[0.025] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur" role="group" aria-label={isArabic ? "أقسام المنيو" : "Menu categories"}>
        {[{ id: "", name: isArabic ? "الكل" : "All" }, ...categories].map((category) => {
          const selected = activeCategory === category.id;
          return <button aria-pressed={selected} className="relative overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-300" key={category.id} onClick={() => setActiveCategory(category.id)} type="button">
            <span className={selected ? "absolute inset-0 rounded-full border border-[color:var(--primary)] storefront-action shadow-[0_14px_42px_color-mix(in_srgb,var(--sf-primary)_34%,transparent)]" : "absolute inset-0 rounded-full border border-white/10 bg-white/[0.03] transition-all duration-300 hover:border-[color:var(--primary)]/35 hover:bg-white/[0.07]"} />
            <span className={selected ? "relative z-10 text-[color:var(--sf-on-primary)]" : "relative z-10 text-[color:var(--text-muted)] transition-colors duration-300 hover:text-[color:var(--text)]"}>{category.name}</span>
          </button>;
        })}
      </div>
      <div className="relative mt-12 rounded-[1.75rem] border border-white/10 bg-[color:var(--card)]/40 shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur sm:p-5 lg:p-8">
        {displayed.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{displayed.map((item) => (
          <StorefrontProductCard key={item.id} product={item} categoryName={categoryNames.get(item.categoryId)} />
        ))}</div> : <div className="flex min-h-48 items-center justify-center text-center text-[color:var(--text-muted)]">{isArabic ? "لا توجد أطباق متاحة في هذا القسم الآن." : "No dishes are available in this category yet."}</div>}
      </div>
      <div className="mt-10 flex justify-center"><Link className="storefront-action rounded-full px-8 py-3 text-sm font-bold shadow-[0_18px_48px_color-mix(in_srgb,var(--sf-primary)_28%,transparent)] transition-all duration-300 hover:-translate-y-1" href={href(routes.menu)}>{isArabic ? "عرض المنيو الكاملة" : "View Full Menu"}</Link></div>
    </div>
  </section>;
}
