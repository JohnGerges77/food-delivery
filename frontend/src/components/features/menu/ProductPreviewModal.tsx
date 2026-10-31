"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, Plus, X } from "lucide-react";
import { publicMoney } from "@/lib/public-menu-presentation";
import { sectionEase } from "@/lib/animations";
import type { PublicProduct } from "@/services/public-menu";
import { PublicProductImage } from "@/components/features/storefront/PublicProductImage";

function QuantityControl({
  quantity,
  onDecrease,
  onIncrease,
  isArabic,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  isArabic: boolean;
}) {
  return (
    <div className="inline-grid h-12 grid-cols-[2.75rem_3rem_2.75rem] overflow-hidden rounded-full border border-white/12 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <button
        aria-label={isArabic ? "تقليل الكمية" : "Decrease quantity"}
        className="flex items-center justify-center text-[color:var(--text-muted)] transition-colors hover:bg-white/[0.08] hover:text-[color:var(--primary-light)]"
        onClick={onDecrease}
        type="button"
      >
        <Minus aria-hidden="true" size={16} />
      </button>
      <span className="flex items-center justify-center border-x border-white/10 text-sm font-bold text-[color:var(--text)]">
        {quantity}
      </span>
      <button
        aria-label={isArabic ? "زيادة الكمية" : "Increase quantity"}
        className="flex items-center justify-center text-[color:var(--text-muted)] transition-colors hover:bg-white/[0.08] hover:text-[color:var(--primary-light)]"
        onClick={onIncrease}
        type="button"
      >
        <Plus aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

export function ProductPreviewModal({
  product,
  quantity,
  locale,
  isArabic,
  categoryLabel,
  currency,
  onClose,
  onDecrease,
  onIncrease,
  onAdd,
}: {
  product: PublicProduct | null;
  quantity: number;
  locale: string;
  isArabic: boolean;
  categoryLabel: string;
  currency: string;
  onClose: () => void;
  onDecrease: () => void;
  onIncrease: () => void;
  onAdd: () => void;
}) {
  return (
    <AnimatePresence>
      {product ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-black/72 px-3 py-3 backdrop-blur-md sm:place-items-center sm:px-4 sm:py-6"
          data-lenis-prevent
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} ${isArabic ? "معاينة سريعة" : "quick preview"}`}
          onClick={onClose}
        >
          <motion.div
            className="relative grid max-h-[92svh] w-full max-w-5xl overflow-hidden rounded-[1.4rem] border border-white/12 bg-[linear-gradient(145deg,rgba(31,31,31,0.96),rgba(13,13,13,0.98)_56%,rgba(255,122,0,0.08))] shadow-[0_42px_140px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.08)] sm:rounded-[1.7rem] lg:grid-cols-[0.95fr_1.05fr]"
            initial={{ opacity: 0, scale: 0.94, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{ duration: 0.3, ease: sectionEase }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              aria-label={isArabic ? "إغلاق المعاينة" : "Close preview"}
              className="absolute right-4 top-4 z-10 flex size-11 items-center justify-center rounded-full border border-white/10 bg-[color:var(--background)]/70 text-[color:var(--text)] backdrop-blur transition-colors hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
            <div className="relative min-h-64 sm:min-h-72 lg:min-h-[36rem]">
              <PublicProductImage alt={product.name} className="object-cover" sizes="(min-width: 1024px) 45vw, 100vw" src={product.imageUrl || product.images[0]} />
              <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)]/72 via-transparent to-black/10" />
            </div>
            <div className="overflow-y-auto p-6 sm:p-8 lg:p-10">
              <div className="mb-4 inline-flex rounded-full border border-[color:var(--primary)]/35 bg-[color:var(--primary)]/10 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-[color:var(--primary-light)] uppercase">
                {categoryLabel}
              </div>
              <h2 className="text-3xl font-semibold leading-tight text-balance sm:text-4xl">
                {product.name}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--text-muted)] sm:text-base sm:leading-8">
                {product.description}
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    {isArabic ? "السعر" : "Price"}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-[color:var(--primary-light)]">
                    {publicMoney(product.price, currency, locale)}
                  </div>
                </div>
                {product.oldPrice !== null && product.oldPrice > product.price && <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">{isArabic ? "السعر السابق" : "Previous Price"}</div>
                  <div className="mt-2 text-2xl font-semibold text-[color:var(--text-muted)] line-through">{publicMoney(product.oldPrice, currency, locale)}</div>
                </div>}
                {product.preparationTime !== null && <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    {isArabic ? "وقت التحضير" : "Prep"}
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{product.preparationTime}m</div>
                </div>}
              </div>
              <div className="mt-7 rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between text-sm text-[color:var(--text-muted)]">
                  <span>{isArabic ? "الكمية" : "Quantity"}</span>
                  <span>{isArabic ? "الإجمالي المعروض" : "Displayed total"}</span>
                </div>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <QuantityControl
                    isArabic={isArabic}
                    quantity={quantity}
                    onDecrease={onDecrease}
                    onIncrease={onIncrease}
                  />
                  <div className="text-3xl font-semibold text-[color:var(--primary-light)]">
                    {publicMoney(product.price * quantity, currency, locale)}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  className="inline-flex min-h-13 items-center justify-center rounded-full border border-white/12 bg-white/[0.045] px-7 text-sm font-bold text-[color:var(--text)] transition-colors hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
                  onClick={onClose}
                  type="button"
                >
                  {isArabic ? "متابعة التصفح" : "Keep Browsing"}
                </button>
                <button
                  className="inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-7 text-sm font-bold text-[color:var(--background)] shadow-[0_20px_56px_rgba(255,122,0,0.36)] transition-transform hover:-translate-y-0.5"
                  onClick={onAdd}
                  type="button"
                >
                  <Check aria-hidden="true" size={18} />
                  {isArabic ? "أضف إلى السلة" : "Add To Cart"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default ProductPreviewModal;
