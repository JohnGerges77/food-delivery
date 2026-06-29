"use client";

import {
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { useCartStore } from "@/store/cart-store";
import type { Product } from "@/types";

const ProductPreviewModal = dynamic(() => import("./ProductPreviewModal"), {
  ssr: false,
});

const categories = [
  { id: "all", label: "All" },
  { id: "cat-burgers", label: "Burgers" },
  { id: "cat-pizza", label: "Pizza" },
  { id: "cat-pasta", label: "Pasta" },
  { id: "cat-chicken", label: "Chicken" },
  { id: "cat-desserts", label: "Desserts" },
  { id: "cat-drinks", label: "Drinks" },
];

const categoryLabels = new Map(categories.map((category) => [category.id, category.label]));

function getCategoryLabel(categoryId: string) {
  return categoryLabels.get(categoryId) ?? "Signature";
}

function sortProducts(products: Product[], sortBy: string) {
  return [...products].sort((first, second) => {
    if (sortBy === "price-low") {
      return first.price - second.price;
    }

    if (sortBy === "price-high") {
      return second.price - first.price;
    }

    if (sortBy === "rating") {
      return second.rating - first.rating;
    }

    return Number(second.isFeatured) - Number(first.isFeatured) || second.rating - first.rating;
  });
}

export function MenuOrderingPage({ products }: { products: Product[] }) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const localizedCategories = categories.map((category) => ({
    ...category,
    label: isArabic
      ? ({all: "الكل", "cat-burgers": "البرجر", "cat-pizza": "البيتزا", "cat-pasta": "الباستا", "cat-chicken": "الدجاج", "cat-desserts": "الحلويات", "cat-drinks": "المشروبات"} as Record<string, string>)[category.id]
      : category.label,
  }));
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [previewQuantity, setPreviewQuantity] = useState(1);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCategory =
        activeCategory === "all" || product.categoryId === activeCategory;
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.description, getCategoryLabel(product.categoryId)]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });

    return sortProducts(filtered, sortBy);
  }, [activeCategory, products, query, sortBy]);

  function openPreview(product: Product) {
    setSelectedProduct(product);
    setPreviewQuantity(1);
  }

  function addProduct(product: Product, quantity = 1) {
    addItem(product, quantity);
  }

  function getCartQuantity(productId: string) {
    return cartItems.find((item) => item.productId === productId)?.quantity ?? 0;
  }

  return (
    <main className="overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]">
    

      <section className="sticky top-[1.45rem] z-30 border-y border-white/10 bg-[color:var(--background)]/86 px-4 py-3 shadow-[0_18px_56px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[minmax(15rem,0.75fr)_minmax(0,1.25fr)] lg:items-center">
          <label className="relative block">
            <span className="sr-only">{isArabic ? "ابحث في القائمة" : "Search menu"}</span>
            <Search
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--primary-light)]"
              size={18}
            />
            <input
              className="h-13 w-full rounded-full border border-white/10 bg-white/[0.045] pl-12 pr-12 text-sm text-[color:var(--text)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all placeholder:text-[color:var(--text-muted)]/60 focus:border-[color:var(--primary)]/65 focus:shadow-[0_0_0_4px_rgba(255,122,0,0.12)]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isArabic ? "ابحث عن الأطباق أو النكهات أو الأقسام..." : "Search dishes, flavors, categories..."}
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
                onClick={() => setActiveCategory(category.id)}
                type="button"
              >
                <span>{category.label}</span>
                {category.id !== "all" ? (
                  <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[0.68rem]">
                    {products.filter((product) => product.categoryId === category.id).length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* <label className="relative block">
            <span className="sr-only">Sort menu</span>
            <SlidersHorizontal
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--primary-light)]"
              size={17}
            />
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]"
              size={17}
            />
            <select
              className="h-13 w-full appearance-none rounded-full border border-white/10 bg-white/[0.045] pl-12 pr-11 text-sm font-semibold text-[color:var(--text)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all focus:border-[color:var(--primary)]/65 focus:shadow-[0_0_0_4px_rgba(255,122,0,0.12)]"
              onChange={(event) => setSortBy(event.target.value)}
              value={sortBy}
            >
              {sortOptions.map((option) => (
                <option className="bg-[color:var(--background)] text-[color:var(--text)]" key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label> */}
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
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

          {visibleProducts.length === 0 ? (
            <div
              className="rounded-[1.45rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.075),rgba(255,255,255,0.026)_60%,rgba(255,122,0,0.04))] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl"
            >
              <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]">
                <Search aria-hidden="true" size={26} />
              </div>
              <h3 className="mt-5 text-2xl font-semibold">{isArabic ? "لا توجد أطباق" : "No dishes found"}</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[color:var(--text-muted)]">
                {isArabic ? "جرّب بحثًا أو قسمًا مختلفًا." : "Try a different craving, category, or sort order."}
              </p>
              <button
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.045] px-6 text-sm font-bold text-[color:var(--text)] transition-colors hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
                onClick={() => {
                  setQuery("");
                  setActiveCategory("all");
                  setSortBy("featured");
                }}
                type="button"
              >
                {isArabic ? "إعادة ضبط الفلاتر" : "Reset Filters"}
              </button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => {
                const productCartQuantity = getCartQuantity(product.id);

                return (
              <article
                className="group relative cursor-pointer overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.082),rgba(255,255,255,0.026)_60%,rgba(255,122,0,0.045))] shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-[color:var(--primary)]/50 hover:shadow-[0_32px_96px_rgba(255,122,0,0.16)]"
                key={product.id}
                onClick={() => openPreview(product)}
              >
                <div className="relative aspect-[1.22] overflow-hidden">
                  <Image
                    alt={product.name}
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.08]"
                    fill
                    sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                    src={product.image}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-transparent to-black/10" />
                  <div className="absolute left-4 top-4 rounded-full border border-[color:var(--primary)]/35 bg-[color:var(--background)]/70 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-[color:var(--primary-light)] uppercase backdrop-blur">
                    {getCategoryLabel(product.categoryId)}
                  </div>
                  {product.isFeatured ? (
                    <div className="absolute right-4 top-4 rounded-full border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/12 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-[color:var(--gold)] uppercase backdrop-blur">
                      {isArabic ? "مميز" : "Featured"}
                    </div>
                  ) : null}
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-xl font-semibold leading-tight text-[color:var(--text)]">
                      {product.name}
                    </h3>
                    <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-sm font-semibold text-[color:var(--gold)]">
                      <Star aria-hidden="true" className="fill-current" size={14} />
                      {product.rating}
                    </div>
                  </div>
                  <p className="mt-3 min-h-14 text-sm leading-7 text-[color:var(--text-muted)]">
                    {product.description}
                  </p>
                  <div className="mt-5 flex items-center gap-3 text-xs font-semibold tracking-[0.16em] text-[color:var(--gold)] uppercase">
                    <span>{product.preparationTime} {isArabic ? "دقيقة" : "min"}</span>
                    <span className="size-1 rounded-full bg-white/20" />
                    <span>{product.calories ?? (isArabic ? "الشيف" : "Chef")} {isArabic ? "سعرة" : "cal"}</span>
                    {productCartQuantity > 0 ? (
                      <>
                        <span className="size-1 rounded-full bg-white/20" />
                        <span className="text-[color:var(--primary-light)]">
                          {isArabic ? `${productCartQuantity} في السلة` : `${productCartQuantity} in cart`}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                        {isArabic ? "السعر" : "Price"}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-[color:var(--primary-light)]">
                        {formatCurrency(product.price, locale)}
                      </div>
                    </div>
                    <button
                      className="inline-flex cursor-pointer min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-5 text-sm font-bold text-[color:var(--background)] shadow-[0_18px_48px_rgba(255,122,0,0.3)] transition-transform hover:-translate-y-0.5"
                      onClick={(event) => {
                        event.stopPropagation();
                        addProduct(product);
                      }}
                      type="button"
                    >
                      {isArabic ? "أضف" : "Add"}
                      <Plus aria-hidden="true" size={16} />
                    </button>
                  </div>
                </div>
              </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedProduct ? (
        <ProductPreviewModal
          product={selectedProduct}
          quantity={previewQuantity}
          locale={locale}
          isArabic={isArabic}
          categoryLabel={getCategoryLabel(selectedProduct.categoryId)}
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
