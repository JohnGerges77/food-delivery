"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import type { PublicProduct } from "@/services/public-menu";
import { publicMoney } from "@/lib/public-menu-presentation";
import { useCartStore } from "@/store/cart-store";
import { useStorefront } from "./StorefrontContext";

export function ProductPurchase({ product, buttonClassName }: { product: PublicProduct; buttonClassName: string }) {
  const locale = useLocale(); const ar = locale === 'ar';
  const { restaurant, orderingEnabled } = useStorefront();
  const add = useCartStore((state) => state.addPublicItem);
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState<"added" | "failed" | null>(null);
  const variant = product.variants?.find((v) => v.id === selected && v.isAvailable);
  if (!orderingEnabled) {
    if (!product.variants?.length) return null;
    return <div className="mt-5 w-full min-w-0">
      <h2 className="mb-2 font-semibold">{ar ? "الأحجام والأنواع" : "Sizes and variants"}</h2>
      <dl className="grid gap-2">
        {product.variants.map((v) => <div key={v.id} className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-[color:var(--sf-border)] p-3 text-sm">
          <dt>{v.name}{!v.isAvailable && (ar ? " — غير متاح" : " — Unavailable")}</dt>
          <dd>{publicMoney(v.price, restaurant.currency, locale)}</dd>
        </div>)}
      </dl>
    </div>;
  }
  return <div className="mt-5 w-full min-w-0">
    {Boolean(product.variants?.length) && <fieldset className="grid gap-2"><legend className="mb-2 font-semibold">{ar ? 'اختر الحجم أو النوع' : 'Choose a size or variant'}</legend>
      {product.variants!.map((v) => <label key={v.id} className="storefront-variant flex min-h-11 flex-wrap items-center gap-3 rounded-lg border border-[color:var(--sf-border)] p-3 text-sm">
        <input type="radio" name={`variant-${product.id}`} value={v.id} checked={selected === v.id} disabled={!v.isAvailable}
          onChange={() => { setSelected(v.id); setFeedback(null); }} />
        <span>{v.name}{!v.isAvailable ? (ar ? ' — غير متاح' : ' — Unavailable') : ''}</span><span className="ms-auto">{publicMoney(v.price, restaurant.currency, locale)}</span>
      </label>)}
      {variant && <p className="font-semibold">{publicMoney(variant.price, restaurant.currency, locale)}</p>}
    </fieldset>}
    <button type="button" className={`${buttonClassName} disabled:cursor-not-allowed disabled:opacity-50`} disabled={Boolean(product.variants?.length) && !variant}
      onClick={() => setFeedback(add(restaurant.slug, product, 1, variant?.id) ? "added" : "failed")}>{ar ? 'أضف إلى السلة' : 'Add to cart'}</button>
    {feedback === "added" && <p className="mt-2 text-sm" role="status">{ar ? "تمت الإضافة إلى السلة." : "Added to cart."}</p>}
    {feedback === "failed" && <p className="mt-2 text-sm" role="alert">{ar ? "تعذرت الإضافة إلى السلة." : "Could not add this item to the cart."}</p>}
  </div>;
}
