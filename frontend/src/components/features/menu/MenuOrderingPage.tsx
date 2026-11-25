"use client";

import {
  Search,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { getPublicProducts, type PublicPage, type PublicProduct } from "@/services/public-menu";
import { StorefrontProductCard } from "@/components/features/storefront/StorefrontProductCard";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";

export function MenuOrderingPage({ initialProducts, initialPagination }: {
  initialProducts: PublicProduct[]; initialPagination: PublicPage | null;
}) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { restaurant, categories } = useStorefront();
  const localizedCategories = [{ id: "all", label: isArabic ? "الكل" : "All" },
    ...categories.map((category) => ({ id: category.id, label: category.name }))];
  const categoryLabels = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const [products, setProducts] = useState(initialProducts);
  const [pagination, setPagination] = useState(initialPagination);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (activeCategory === "all") return;
    let active = true;
    getPublicProducts(restaurant.slug, 1, { categoryId: activeCategory, locale }).then((result) => {
      if (active) { setProducts(result.products); setPagination(result.pagination); setLoading(false); setMenuError(""); }
    }).catch(() => {
      if (active) { setLoading(false); setMenuError(isArabic ? "تعذّر تحميل القسم. حاول مجددًا." : "Could not load this category. Try again."); }
    });
    return () => { active = false; };
  }, [activeCategory, restaurant.slug, retry, isArabic, locale]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "all" || product.categoryId === activeCategory;
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.description ?? "", categoryLabels.get(product.categoryId) ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return categoryLabels.has(product.categoryId) && matchesCategory && matchesQuery;
    });
  }, [activeCategory, products, query, categoryLabels]);

  function selectCategory(categoryId: string) {
    if (categoryId === activeCategory) return;
    setActiveCategory(categoryId);
    setQuery("");
    setMenuError("");
    setLoading(categoryId !== "all");
    setProducts(categoryId === "all" ? initialProducts : []);
    setPagination(categoryId === "all" ? initialPagination : null);
  }

  async function loadMore() {
    if (!pagination?.hasNext || loading) return;
    setLoading(true);
    setMenuError("");
    try {
      const result = await getPublicProducts(restaurant.slug, pagination.page + 1,
        { locale, ...(activeCategory === "all" ? {} : { categoryId: activeCategory }) });
      setProducts((current) => [...current, ...result.products]);
      setPagination(result.pagination);
    } catch {
      setMenuError(isArabic ? "تعذّر تحميل المزيد. حاول مجددًا." : "Could not load more dishes. Try again.");
    } finally { setLoading(false); }
  }

  return (
    <main className="overflow-x-clip bg-[color:var(--background)] text-[color:var(--text)]">
      <section data-menu-filters className="relative lg:sticky z-30 border-y border-white/10 bg-[color:var(--background)]/86 px-4 py-3 shadow-[0_18px_56px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:px-6 lg:top-[4.75rem] lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[minmax(15rem,0.75fr)_minmax(0,1.25fr)] lg:items-center">
          <label className="relative block">
            <span className="sr-only">{isArabic ? "ابحث في الأطباق المحمّلة" : "Search loaded dishes"}</span>
            <Search
              aria-hidden="true"
              className="absolute start-4 top-1/2 -translate-y-1/2 text-[color:var(--primary-light)]"
              size={18}
            />
            <input
              className="h-13 w-full rounded-full border border-white/10 bg-white/[0.045] pl-12 pr-12 text-sm text-[color:var(--text)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all placeholder:text-[color:var(--text-muted)]/60 focus:border-[color:var(--primary)]/65 focus:shadow-[0_0_0_4px_rgba(255,122,0,0.12)]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isArabic ? "ابحث في الأطباق المحمّلة..." : "Search loaded dishes..."}
              type="search"
              value={query}
            />
            {query ? (
              <button
                aria-label={isArabic ? "مسح البحث" : "Clear search"}
                className="absolute end-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/[0.08] hover:text-[color:var(--primary-light)]"
                onClick={() => setQuery("")}
                type="button"
              >
                <X aria-hidden="true" size={15} />
              </button>
            ) : null}
          </label>

          <div
            aria-label={isArabic ? "أقسام المنيو" : "Menu categories"}
            className="flex flex-wrap gap-2 lg:justify-end"
            role="group"
          >
            {localizedCategories.map((category) => (
              <button
                className={`h-10 flex-auto rounded-full border px-3 text-xs font-semibold transition-all sm:h-11 sm:flex-none sm:px-4 sm:text-sm ${
                  activeCategory === category.id
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--background)] shadow-[0_14px_34px_rgba(255,122,0,0.28)]"
                    : "border-white/10 bg-white/[0.035] text-[color:var(--text-muted)] hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
                }`}
                key={category.id}
                onClick={() => selectCategory(category.id)}
                aria-pressed={activeCategory === category.id}
                type="button"
              >
                <span>{category.label}</span>
              </button>
            ))}
          </div>

        </div>
      </section>

      <p className="mx-auto max-w-7xl px-4 pt-4 text-xs text-[color:var(--text-muted)] sm:px-6 lg:px-8">
        {isArabic ? "البحث يشمل الأطباق المحمّلة فقط؛ حمّل المزيد للبحث في الباقي." : "Search covers loaded dishes only. Load more to include the rest."}
      </p>
      <section data-menu-list className="px-4 py-8 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-semibold tracking-[0.22em] text-[color:var(--gold)] uppercase">
                {isArabic ? `${visibleProducts.length} طبق` : `${visibleProducts.length} dishes`}
              </div>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">
                {isArabic ? "اختر طبقك المفضل القادم" : "Choose Your Next Favorite"}
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[color:var(--text-muted)]">
              {isArabic ? "اضغط على أي طبق لمشاهدته أو أضفه مباشرة إلى سلتك." : "Tap any dish for a closer look, or add it straight to your cart."}
            </p>
          </div>

          {menuError && <div className="mb-6 rounded-[1.2rem] border border-red-400/30 bg-red-400/10 p-5" role="alert">{menuError}<button className="ml-3 underline" onClick={() => activeCategory === "all" ? loadMore() : setRetry((value) => value + 1)} type="button">{isArabic ? "إعادة المحاولة" : "Retry"}</button></div>}
          {loading && products.length === 0 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={isArabic ? "جار تحميل المنيو" : "Loading menu"}>{[1, 2, 3, 4].map((value) => <div className="h-80 animate-pulse rounded-[1.35rem] bg-white/[0.06]" key={value} />)}</div> : visibleProducts.length === 0 ? (
            <div
              className="rounded-[1.45rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.075),rgba(255,255,255,0.026)_60%,rgba(255,122,0,0.04))] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl"
            >
              <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]">
                <Search aria-hidden="true" size={26} />
              </div>
              <h3 className="mt-5 text-2xl font-semibold">{isArabic ? "لا توجد أطباق" : "No dishes found"}</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[color:var(--text-muted)]">
                {query ? (isArabic ? "لا توجد نتائج في الأطباق المحمّلة." : "No matches in loaded dishes.") : activeCategory === "all" ? (isArabic ? "لا توجد أطباق متاحة الآن." : "No dishes are available yet.") : (isArabic ? "لا توجد أطباق متاحة في هذا القسم الآن." : "No dishes are available in this category yet.")}
              </p>
              <button
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.045] px-6 text-sm font-bold text-[color:var(--text)] transition-colors hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
                onClick={() => {
                  setQuery("");
                  selectCategory("all");
                }}
                type="button"
              >
                {isArabic ? "إعادة ضبط الفلاتر" : "Reset Filters"}
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {visibleProducts.map((product) => <StorefrontProductCard key={product.id}
                product={product} categoryName={categoryLabels.get(product.categoryId)} />)}
            </div>
          )}
          {pagination?.hasNext && <div className="mt-10 flex justify-center"><button className="min-h-12 rounded-full border border-[color:var(--primary)]/45 bg-white/[0.04] px-8 text-sm font-bold text-[color:var(--primary-light)] transition-all hover:bg-[color:var(--primary)]/12 disabled:opacity-50" disabled={loading} onClick={loadMore} type="button">{loading ? (isArabic ? "جار التحميل…" : "Loading…") : (isArabic ? "تحميل المزيد" : "Load More")}</button></div>}
        </div>
      </section>

    </main>
  );
}
