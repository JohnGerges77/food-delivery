"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { publicMoney } from "@/lib/public-menu-presentation";
import type { PublicProduct } from "@/services/public-menu";
import { PublicProductImage } from "@/components/features/storefront/PublicProductImage";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";

export function FeaturedProducts({ products }: { products: PublicProduct[] }) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { restaurant, categories, href } = useStorefront();
  const [activeCategory, setActiveCategory] = useState("");
  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const displayed = products.filter((item) => categoryNames.has(item.categoryId) &&
    (!activeCategory || item.categoryId === activeCategory)).slice(0, 6);

  return <section className="relative isolate overflow-hidden bg-[color:var(--background)] px-4 py-20 text-[color:var(--text)] sm:px-6 lg:px-8">
    <div className="absolute left-[-10rem] top-20 -z-10 size-[26rem] rounded-full bg-[color:var(--primary)]/10 blur-3xl" />
    <div className="absolute bottom-0 right-0 -z-10 size-[34rem] translate-x-1/3 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.16),transparent_68%)] blur-3xl" />
    <div className="mx-auto max-w-7xl">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-5 flex items-center justify-center gap-4 text-xs font-semibold tracking-[0.24em] text-[color:var(--primary-light)] uppercase"><span className="h-px w-10 bg-[color:var(--primary)]/60" />{isArabic ? "قائمتنا" : "Our Menu"}<span className="h-px w-10 bg-[color:var(--primary)]/60" /></div>
        <h2 className="text-4xl font-semibold text-balance text-[color:var(--text)] sm:text-5xl lg:text-6xl">{isArabic ? "تعرّف على القائمة" : "Discover the Menu"}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">{isArabic ? "لمحة من الأطباق المتاحة لدى المطعم." : "A preview of this restaurant's available dishes."}</p>
      </div>
      <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2 rounded-[2rem] border border-white/10 bg-white/[0.025] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur" role="group" aria-label={isArabic ? "أقسام القائمة" : "Menu categories"}>
        {[{ id: "", name: isArabic ? "الكل" : "All" }, ...categories].map((category) => {
          const selected = activeCategory === category.id;
          return <button aria-pressed={selected} className="relative overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-300" key={category.id} onClick={() => setActiveCategory(category.id)} type="button">
            <span className={selected ? "absolute inset-0 rounded-full border border-[color:var(--primary)] bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] shadow-[0_14px_42px_rgba(255,122,0,0.34)]" : "absolute inset-0 rounded-full border border-white/10 bg-white/[0.03] transition-all duration-300 hover:border-[color:var(--primary)]/35 hover:bg-white/[0.07]"} />
            <span className={selected ? "relative z-10 text-[color:var(--background)]" : "relative z-10 text-[color:var(--text-muted)] transition-colors duration-300 hover:text-[color:var(--text)]"}>{category.name}</span>
          </button>;
        })}
      </div>
      <div className="relative mt-12 rounded-[1.75rem] border border-white/10 bg-[color:var(--card)]/40 p-3 shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur sm:p-5 lg:p-8">
        <div className="pointer-events-none absolute inset-y-8 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-[color:var(--primary)]/25 to-transparent lg:block" />
        {displayed.length ? <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-10">{displayed.map((item) => <Link className="group relative grid grid-cols-[4.75rem_1fr_auto] items-center gap-4 overflow-hidden rounded-2xl border border-white/0 bg-white/[0.02] p-3 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--primary)]/35 hover:bg-white/[0.07] hover:shadow-[0_22px_54px_rgba(255,122,0,0.14)] sm:grid-cols-[5.5rem_1fr_auto] sm:p-4" href={href(`/menu/${item.id}`)} key={item.id}>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-[color:var(--primary)]/0 to-transparent transition-colors duration-300 group-hover:via-[color:var(--primary)]/80" />
          <div className="pointer-events-none absolute -right-12 top-1/2 size-28 -translate-y-1/2 rounded-full bg-[color:var(--primary)]/0 blur-2xl transition-colors duration-500 group-hover:bg-[color:var(--primary)]/18" />
          <div className="relative size-[4.75rem] overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--background)] transition-all duration-300 group-hover:border-[color:var(--primary)]/35 group-hover:shadow-[0_0_28px_rgba(255,122,0,0.14)] sm:size-[5.5rem]"><PublicProductImage alt={item.name} className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="5.5rem" src={item.imageUrl || item.images[0]} /></div>
          <div className="min-w-0"><div className="text-[0.65rem] font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">{categoryNames.get(item.categoryId)}</div><h3 className="mt-1 truncate text-base font-semibold text-[color:var(--text)] transition-colors duration-300 group-hover:text-[color:var(--primary-light)] sm:text-lg">{item.name}</h3>{item.description && <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--text-muted)]">{item.description}</p>}</div>
          <div className="self-start rounded-full border border-[color:var(--primary)]/10 bg-[color:var(--primary)]/10 px-3 py-1 text-sm font-bold text-[color:var(--primary-light)] transition-all duration-300 group-hover:border-[color:var(--primary)]/35 group-hover:bg-[color:var(--primary)]/15">{publicMoney(item.price, restaurant.currency, locale)}</div>
        </Link>)}</div> : <div className="flex min-h-48 items-center justify-center text-center text-[color:var(--text-muted)]">{isArabic ? "لا توجد أطباق متاحة في هذا القسم الآن." : "No dishes are available in this category yet."}</div>}
      </div>
      <div className="mt-10 flex justify-center"><Link className="rounded-full bg-[color:var(--primary)] px-8 py-3 text-sm font-bold text-[color:var(--background)] shadow-[0_18px_48px_rgba(255,122,0,0.28)] transition-all duration-300 hover:-translate-y-1 hover:bg-[color:var(--primary-light)]" href={href(routes.menu)}>{isArabic ? "عرض القائمة الكاملة" : "View Full Menu"}</Link></div>
    </div>
  </section>;
}
