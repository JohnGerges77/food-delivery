"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { publicMoney } from "@/lib/public-menu-presentation";
import type { PublicProduct } from "@/services/public-menu";
import { PublicProductImage } from "@/components/features/storefront/PublicProductImage";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";

function BestItemCard({ item, prominent }: { item: PublicProduct; prominent: boolean }) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { restaurant, categories, href } = useStorefront();
  const category = categories.find((entry) => entry.id === item.categoryId);
  return <article className={prominent
    ? "group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[color:var(--card)]/70 shadow-[0_30px_80px_rgba(0,0,0,0.32)] backdrop-blur transition-transform duration-300 hover:-translate-y-1 lg:row-span-2"
    : "group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.035] shadow-[0_18px_54px_rgba(0,0,0,0.28)] backdrop-blur transition-transform duration-300 hover:-translate-y-1"}>
    <Link className="absolute inset-0 z-10" href={href(`/menu/${item.id}`)} aria-label={isArabic ? `تفاصيل ${item.name}` : `Details for ${item.name}`} />
    <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"><div className="absolute -right-20 top-10 size-52 rounded-full bg-[color:var(--primary)]/20 blur-3xl" /></div>
    <div className={prominent ? "relative aspect-[4/5] overflow-hidden sm:aspect-[16/11] lg:aspect-auto lg:h-[34rem]" : "relative aspect-[16/11] overflow-hidden"}>
      <PublicProductImage alt={item.name} className="object-cover transition-transform duration-700 group-hover:scale-110" sizes={prominent ? "(min-width: 1024px) 44vw, 100vw" : "(min-width: 1024px) 28vw, (min-width: 640px) 50vw, 100vw"} src={item.imageUrl || item.images[0]} />
      <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/18 to-transparent" />
      {item.isFeatured && <span className="absolute left-5 top-5 rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--background)]/60 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.18em] text-[color:var(--primary-light)] uppercase backdrop-blur">{isArabic ? "مميز" : "Featured"}</span>}
    </div>
    <div className={prominent ? "p-6 sm:p-7 lg:p-8" : "p-5"}>
      <div className="mb-3 flex items-center gap-3 text-[0.68rem] font-semibold tracking-[0.2em] text-[color:var(--gold)] uppercase"><span className="h-px w-8 bg-[color:var(--primary)]/70" />{category?.name}</div>
      <div className="flex items-start justify-between gap-5"><h3 className={prominent ? "text-3xl font-semibold text-[color:var(--text)] sm:text-4xl" : "text-xl font-semibold text-[color:var(--text)]"}>{item.name}</h3><span className="rounded-full bg-[color:var(--primary)]/10 px-3 py-1 text-sm font-bold text-[color:var(--primary-light)]">{publicMoney(item.price, restaurant.currency, locale)}</span></div>
      {item.description && <p className={prominent ? "mt-4 max-w-xl text-base leading-8 text-[color:var(--text-muted)]" : "mt-3 text-sm leading-6 text-[color:var(--text-muted)]"}>{item.description}</p>}
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--primary-light)] transition-colors duration-300 hover:text-[color:var(--text)]">{isArabic ? "عرض الطبق" : "View Item"}<span className="transition-transform duration-300 group-hover:translate-x-1">-&gt;</span></span>
    </div>
  </article>;
}

export default function BestItems({ products }: { products: PublicProduct[] }) {
  const isArabic = useLocale() === "ar";
  const visible = [...products].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)).slice(0, 5);
  return <section className="relative isolate overflow-hidden bg-[color:var(--background)] px-4 py-20 text-[color:var(--text)] sm:px-6 lg:px-8">
    <div className="absolute left-1/2 top-10 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.16),transparent_66%)] blur-3xl" />
    <div className="absolute bottom-0 right-[-12rem] -z-10 size-[28rem] rounded-full bg-[color:var(--primary)]/10 blur-3xl" />
    <div className="mx-auto max-w-7xl">
      <div className="mx-auto max-w-3xl text-center"><div className="mb-5 flex items-center justify-center gap-4 text-xs font-semibold tracking-[0.24em] text-[color:var(--primary-light)] uppercase"><span className="h-px w-10 bg-[color:var(--primary)]/60" />{isArabic ? "من القائمة" : "From the Menu"}<span className="h-px w-10 bg-[color:var(--primary)]/60" /></div>
        <h2 className="text-4xl font-semibold text-balance text-[color:var(--text)] sm:text-5xl lg:text-6xl">{isArabic ? "استكشف الأطباق" : "Explore the Dishes"}</h2>
      </div>
      {visible.length ? <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-[1.08fr_0.92fr_0.92fr] lg:grid-rows-2">{visible.map((item, index) => <BestItemCard item={item} key={item.id} prominent={index === 0} />)}</div> :
        <div className="relative mt-14 flex min-h-80 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-[color:var(--card)]/70 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.32)]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,122,0,.18),transparent_55%)]" /><p className="relative max-w-lg text-xl text-[color:var(--text-muted)]">{isArabic ? "لا توجد أطباق متاحة حاليًا. يمكنك العودة للقائمة لاحقًا." : "No dishes are available yet. Please check the menu again later."}</p></div>}
    </div>
  </section>;
}
