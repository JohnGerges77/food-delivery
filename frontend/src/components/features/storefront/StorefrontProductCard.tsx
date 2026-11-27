"use client";

import { ListPlus, Plus } from "lucide-react";
import { useLocale } from "next-intl";
import { useState } from "react";
import { StorefrontLink as Link } from "@/components/features/storefront/StorefrontLink";
import { productDisplayPrice, publicMoney } from "@/lib/public-menu-presentation";
import type { PublicProduct } from "@/services/public-menu";
import { useCartStore } from "@/store/cart-store";
import { ProductMetadata } from "./ProductMetadata";
import { PublicProductImage } from "./PublicProductImage";
import { useStorefront } from "./StorefrontContext";

const actionClass = "relative z-20 inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[color:var(--sf-primary)] text-sm font-bold text-[color:var(--sf-on-primary)] transition-colors hover:bg-[color:var(--sf-primary-hover)] active:bg-[color:var(--sf-primary-active)] sm:min-h-12 sm:w-auto sm:px-4";

export function StorefrontProductCard({ product, categoryName }: {
  product: PublicProduct;
  categoryName?: string;
}) {
  const locale = useLocale();
  const ar = locale === "ar";
  const { restaurant, href, orderingEnabled } = useStorefront();
  const addItem = useCartStore((state) => state.addPublicItem);
  const quantity = useCartStore((state) => state.tenantSlug !== restaurant.slug ? 0 :
    state.items.reduce((sum, item) => sum + (item.productId === product.id ? item.quantity : 0), 0));
  const [failed, setFailed] = useState(false);
  const details = href("/menu/" + product.id);
  const hasVariants = Boolean(product.variants?.length);

  return <article data-menu-card className="group relative flex min-w-0 overflow-hidden rounded-[1.1rem] border border-[color:var(--sf-border)] bg-[color:var(--sf-surface)] shadow-sm focus-within:ring-2 focus-within:ring-[color:var(--sf-primary)] sm:block sm:rounded-[1.35rem]">
    <Link href={details} className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[color:var(--sf-primary)]"
      aria-label={(ar ? "تفاصيل " : "Details for ") + product.name} />
    <div data-menu-image className="relative m-2 aspect-square w-20 shrink-0 self-start overflow-hidden rounded-lg min-[360px]:w-24 sm:m-0 sm:aspect-[1.5] sm:w-auto sm:rounded-none">
      <PublicProductImage alt={product.name} className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 96px"
        src={product.imageUrl || product.images[0]} variant="small" />
      <div data-menu-overlay className="absolute inset-0 hidden bg-gradient-to-t from-[color:var(--background)] via-transparent to-black/10 sm:block" />
      {categoryName && <span className="absolute start-4 top-4 hidden max-w-[calc(100%-2rem)] truncate rounded-full border border-[color:var(--sf-border)] bg-[color:var(--sf-surface)] px-3 py-1 text-xs font-semibold text-[color:var(--sf-text)] sm:block">{categoryName}</span>}
      {product.isFeatured && <span data-menu-featured className="absolute bottom-4 end-4 hidden rounded-full bg-[color:var(--sf-surface)] px-3 py-1 text-xs font-semibold text-[color:var(--sf-text)] sm:block">{ar ? "مميز" : "Featured"}</span>}
    </div>
    <div className="min-w-0 flex-1 py-3 ps-1 pe-2 sm:p-4">
      <h3 className="break-words text-sm font-semibold leading-tight sm:text-lg">{product.name}</h3>
      {product.description && <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-[color:var(--sf-text-muted)] sm:text-sm">{product.description}</p>}
      <ProductMetadata product={product} locale={locale} compact />
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-2 gap-y-1 sm:mt-4 sm:items-center">
        <div className="min-w-0 break-words text-sm font-semibold text-[color:var(--sf-accent-ink)] sm:text-lg">
          {productDisplayPrice(product, restaurant.currency, locale)}
          {!hasVariants && product.oldPrice !== null && product.oldPrice > product.price &&
            <del className="ms-2 text-xs text-[color:var(--sf-text-muted)]">{publicMoney(product.oldPrice, restaurant.currency, locale)}</del>}
        </div>
        {!orderingEnabled ? <Link href={details} className="relative z-20 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--sf-accent-ink)] underline underline-offset-4">
          {ar ? "عرض التفاصيل" : "View details"}
        </Link> : hasVariants
          ? <Link data-product-action href={details} className={actionClass}
              aria-label={(ar ? "اختر نوع " : "Choose a variant for ") + product.name}>
              <span className="sr-only sm:not-sr-only">{ar ? "اختر" : "Choose"}</span>
              <ListPlus aria-hidden="true" size={16} />
            </Link>
          : <button data-product-action className={actionClass} type="button"
              onClick={() => setFailed(!addItem(restaurant.slug, product))}
              aria-label={(ar ? "أضف إلى السلة: " : "Add to cart: ") + product.name}>
              <span className="sr-only sm:not-sr-only">{ar ? "أضف" : "Add"}</span>
              <Plus aria-hidden="true" size={16} />
            </button>}
      </div>
      {orderingEnabled && quantity > 0 && <p className="mt-1 text-xs text-[color:var(--sf-text-muted)]" role="status">{ar ? quantity + " في السلة" : quantity + " in cart"}</p>}
      {orderingEnabled && failed && <p className="mt-1 text-xs" role="alert">{ar ? "تعذرت الإضافة إلى السلة." : "Could not add this item to the cart."}</p>}
    </div>
  </article>;
}
