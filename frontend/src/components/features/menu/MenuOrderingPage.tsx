"use client";

import {
  Plus,
  Search,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { publicMoney } from "@/lib/public-menu-presentation";
import { useCartStore } from "@/store/cart-store";
import { getPublicProducts, type PublicPage, type PublicProduct } from "@/services/public-menu";
import { PublicProductImage } from "@/components/features/storefront/PublicProductImage";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";

const ProductPreviewModal = dynamic(() => import("./ProductPreviewModal"), {
  ssr: false,
});

export function MenuOrderingPage({ initialProducts, initialPagination }: {
  initialProducts: PublicProduct[]; initialPagination: PublicPage | null;
}) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { restaurant, categories } = useStorefront();
  const localizedCategories = [{ id: "all", label: isArabic ? "الكل" : "All" },
    ...categories.map((category) => ({ id: category.id, label: category.name }))];
  const categoryLabels = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const addItem = useCartStore((state) => state.addPublicItem);
  const cartItems = useCartStore((state) => state.items);
  const cartTenant = useCartStore((state) => state.tenantSlug);
  const [products, setProducts] = useState(initialProducts);
  const [pagination, setPagination] = useState(initialPagination);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);
  const [previewQuantity, setPreviewQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (activeCategory === "all") return;
    let active = true;
    getPublicProducts(restaurant.slug, 1, { categoryId: activeCategory }).then((result) => {
      if (active) { setProducts(result.products); setPagination(result.pagination); setLoading(false); setMenuError(""); }
    }).catch(() => {
      if (active) { setLoading(false); setMenuError(isArabic ? "تعذّر تحميل القسم. حاول مجددًا." : "Could not load this category. Try again."); }
    });
    return () => { active = false; };
  }, [activeCategory, restaurant.slug, retry, isArabic]);

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
    setSelectedProduct(null);
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
        activeCategory === "all" ? {} : { categoryId: activeCategory });
      setProducts((current) => [...current, ...result.products]);
      setPagination(result.pagination);
    } catch {
      setMenuError(isArabic ? "تعذّر تحميل المزيد. حاول مجددًا." : "Could not load more dishes. Try again.");
    } finally { setLoading(false); }
  }

  function openPreview(product: PublicProduct) {
    setSelectedProduct(product);
    setPreviewQuantity(1);
  }

  function addProduct(product: PublicProduct, quantity = 1) {
    addItem(restaurant.slug, product, quantity);
  }

  function getCartQuantity(productId: string) {
    return cartTenant === restaurant.slug ? cartItems.find((item) => item.productId === productId)?.quantity ?? 0 : 0;
  }

  return (
    <main className="overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]">
    

      <section data-menu-filters className="sticky top-[7.25rem] z-30 border-y border-white/10 bg-[color:var(--background)]/86 px-4 py-3 shadow-[0_18px_56px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:px-6 lg:top-[4.75rem] lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[minmax(15rem,0.75fr)_minmax(0,1.25fr)] lg:items-center">
          <label className="relative block">
            <span className="sr-only">{isArabic ? "ابحث في الأطباق المحمّلة" : "Search loaded dishes"}</span>
            <Search
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--primary-light)]"
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
                className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/[0.08] hover:text-[color:var(--primary-light)]"
                onClick={() => setQuery("")}
                type="button"
              >
                <X aria-hidden="true" size={15} />
              </button>
            ) : null}
          </label>

          <div
            aria-label={isArabic ? "أقسام القائمة" : "Menu categories"}
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
      <section data-menu-list className="px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
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
          {loading && products.length === 0 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={isArabic ? "جار تحميل القائمة" : "Loading menu"}>{[1, 2, 3, 4].map((value) => <div className="h-80 animate-pulse rounded-[1.35rem] bg-white/[0.06]" key={value} />)}</div> : visibleProducts.length === 0 ? (
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
              {visibleProducts.map((product) => {
                const productCartQuantity = getCartQuantity(product.id);

                return (
              <article data-menu-card
                className="group relative flex min-h-28 cursor-pointer overflow-hidden rounded-[1.1rem] border border-[color:var(--sf-border)] bg-[color:var(--sf-surface)] shadow-sm transition-all focus-within:ring-2 focus-within:ring-[color:var(--sf-primary)] sm:block sm:rounded-[1.35rem] sm:border-white/10 sm:bg-[linear-gradient(145deg,rgba(255,255,255,0.082),rgba(255,255,255,0.026)_60%,rgba(255,122,0,0.045))] sm:shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.07)] sm:backdrop-blur-xl sm:duration-500 sm:hover:-translate-y-1 sm:hover:border-[color:var(--primary)]/50 sm:hover:shadow-[0_32px_96px_rgba(255,122,0,0.16)]"
                key={product.id}
              >
                <button className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[color:var(--sf-primary)]" aria-label={isArabic ? `معاينة ${product.name}` : `Preview ${product.name}`} onClick={() => openPreview(product)} type="button" />
                <div data-menu-image className="relative m-2 w-24 shrink-0 overflow-hidden rounded-lg sm:m-0 sm:aspect-[1.5] sm:w-auto sm:rounded-none">
                  <PublicProductImage alt={product.name} className="object-cover transition-transform duration-700 group-hover:scale-[1.08]" sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" src={product.imageUrl || product.images[0]} />
                  <div data-menu-overlay className="absolute inset-0 hidden bg-gradient-to-t from-[color:var(--background)] via-transparent to-black/10 sm:block" />
                  <div className="absolute left-4 top-4 hidden max-w-[calc(100%-2rem)] truncate rounded-full border border-[color:var(--primary)]/35 bg-[color:var(--background)]/70 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-[color:var(--primary-light)] uppercase backdrop-blur sm:block">
                    {categoryLabels.get(product.categoryId)}
                  </div>
                  {product.isFeatured ? (
                    <div data-menu-featured className="absolute bottom-4 right-4 hidden max-w-[calc(100%-2rem)] truncate rounded-full border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/12 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-[color:var(--gold)] uppercase backdrop-blur sm:block">
                      {isArabic ? "مميز" : "Featured"}
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 py-3 ps-1 pe-2 sm:p-4">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-[color:var(--text)] sm:text-lg">
                      {product.name}
                    </h3>
                    {product.oldPrice !== null && product.oldPrice > product.price && <span className="hidden shrink-0 text-sm text-[color:var(--text-muted)] line-through sm:block">{publicMoney(product.oldPrice, restaurant.currency, locale)}</span>}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs leading-5 text-[color:var(--text-muted)] sm:mt-2 sm:line-clamp-2 sm:text-sm sm:leading-6">
                    {product.description}
                  </p>
                  <div className="mt-3 hidden items-center gap-2 text-xs font-semibold tracking-[0.16em] text-[color:var(--gold)] uppercase sm:flex">
                    {product.preparationTime !== null && <span>{product.preparationTime} {isArabic ? "دقيقة" : "min"}</span>}
                    {product.preparationTime !== null && product.calories !== null && <span className="size-1 rounded-full bg-white/20" />}
                    {product.calories !== null && <span>{product.calories} {isArabic ? "سعرة" : "cal"}</span>}
                    {productCartQuantity > 0 ? (
                      <>
                        <span className="size-1 rounded-full bg-white/20" />
                        <span className="text-[color:var(--primary-light)]">
                          {isArabic ? `${productCartQuantity} في السلة` : `${productCartQuantity} in cart`}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-end justify-between gap-2 sm:mt-4 sm:items-center">
                    <div>
                      <div className="hidden text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase sm:block">
                        {isArabic ? "السعر" : "Price"}
                      </div>
                      <div className="text-sm font-semibold text-[color:var(--primary-light)] sm:mt-1 sm:text-xl">
                        {publicMoney(product.price, restaurant.currency, locale)}
                      </div>
                    </div>
                    <button
                      aria-label={isArabic ? `أضف ${product.name} إلى السلة` : `Add ${product.name} to cart`}
                      className="relative z-20 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-[color:var(--sf-primary)] text-sm font-bold text-[color:var(--sf-on-primary)] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sf-primary)] sm:min-h-12 sm:w-auto sm:bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] sm:px-4 sm:text-[color:var(--background)] sm:shadow-[0_18px_48px_rgba(255,122,0,0.3)] sm:hover:-translate-y-0.5"
                      onClick={(event) => {
                        event.stopPropagation();
                        addProduct(product);
                      }}
                      type="button"
                    >
                      <span className="sr-only sm:not-sr-only">{isArabic ? "أضف" : "Add"}</span>
                      <Plus aria-hidden="true" size={16} />
                      {productCartQuantity > 0 && <span className="absolute -top-2 -end-2 grid size-5 place-items-center rounded-full bg-[color:var(--sf-accent)] text-[10px] text-[color:var(--sf-background)] sm:hidden">{productCartQuantity}</span>}
                    </button>
                  </div>
                </div>
              </article>
                );
              })}
            </div>
          )}
          {pagination?.hasNext && <div className="mt-10 flex justify-center"><button className="min-h-12 rounded-full border border-[color:var(--primary)]/45 bg-white/[0.04] px-8 text-sm font-bold text-[color:var(--primary-light)] transition-all hover:bg-[color:var(--primary)]/12 disabled:opacity-50" disabled={loading} onClick={loadMore} type="button">{loading ? (isArabic ? "جار التحميل…" : "Loading…") : (isArabic ? "تحميل المزيد" : "Load More")}</button></div>}
        </div>
      </section>

      {selectedProduct ? (
        <ProductPreviewModal
          product={selectedProduct}
          quantity={previewQuantity}
          locale={locale}
          isArabic={isArabic}
          categoryLabel={categoryLabels.get(selectedProduct.categoryId) ?? ""}
          currency={restaurant.currency}
          onClose={() => setSelectedProduct(null)}
          onDecrease={() => setPreviewQuantity((value) => Math.max(1, value - 1))}
          onIncrease={() => setPreviewQuantity((value) => value + 1)}
          onAdd={() => {
            addProduct(selectedProduct, previewQuantity);
            setSelectedProduct(null);
          }}
        />
      ) : null}
    </main>
  );
}
