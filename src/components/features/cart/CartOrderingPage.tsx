"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/formatters";
import { routes } from "@/lib/routes";
import { useCartStore } from "@/store/cart-store";

const sectionEase = [0.16, 1, 0.3, 1] as const;

export function CartOrderingPage({ deliveryFee }: { deliveryFee: number }) {
  const locale = useLocale();
  const items = useCartStore((state) => state.items);
  const increaseQuantity = useCartStore((state) => state.increaseQuantity);
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const getTotal = useCartStore((state) => state.getTotal);
  const subtotal = getSubtotal();
  const total = items.length > 0 ? getTotal(deliveryFee) : 0;
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <main className="min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]">
      <section className="relative isolate overflow-hidden px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_80%_22%,rgba(255,122,0,0.18),transparent_32%),linear-gradient(135deg,rgba(31,31,31,0.84),rgba(13,13,13,1)_55%,rgba(13,13,13,1))]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-36 bg-gradient-to-t from-[color:var(--background)] to-transparent" />
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.72, ease: sectionEase }}
          >
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-[color:var(--primary-light)] uppercase shadow-[0_0_34px_rgba(255,122,0,0.14)] backdrop-blur">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-[color:var(--primary)]/80" />
              Your Cart
              <span className="size-1.5 rounded-full bg-[color:var(--primary-light)] shadow-[0_0_14px_rgba(255,157,51,0.9)]" />
            </div>
            <h1 className="max-w-4xl text-[clamp(3rem,7vw,5.6rem)] font-semibold leading-[0.95] text-balance">
              Review Your
              <span className="block text-[color:var(--primary-light)]">Savora Order</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">
              Fine-tune your selections before we prepare every dish with the care it
              deserves.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
          {items.length === 0 ? (
            <motion.div
              className="rounded-[1.6rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.028)_60%,rgba(255,122,0,0.045))] p-8 text-center shadow-[0_34px_100px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl sm:p-12 lg:col-span-2"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: sectionEase }}
            >
              <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)] shadow-[0_0_42px_rgba(255,122,0,0.2)]">
                <ShoppingBag aria-hidden="true" size={34} />
              </div>
              <h2 className="mt-7 text-3xl font-semibold">Your Cart Is Empty</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[color:var(--text-muted)]">
                Looks like you haven&apos;t added anything yet.
              </p>
              <Link
                className="mt-8 inline-flex min-h-13 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-8 text-sm font-bold text-[color:var(--background)] shadow-[0_20px_56px_rgba(255,122,0,0.34)] transition-transform hover:-translate-y-0.5"
                href={routes.menu}
              >
                Browse Menu
              </Link>
            </motion.div>
          ) : (
            <>
              <div>
                <div className="mb-5 flex flex-col gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold tracking-[0.2em] text-[color:var(--gold)] uppercase">
                      Your Selection
                    </div>
                    <h2 className="mt-1 text-2xl font-semibold">
                      {itemCount} {itemCount === 1 ? "item" : "items"} ready for checkout
                    </h2>
                  </div>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
                    href={routes.menu}
                  >
                    Add More Dishes
                  </Link>
                </div>
                <div className="grid gap-4">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.article
                      className="group grid gap-4 rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.078),rgba(255,255,255,0.028)_58%,rgba(255,122,0,0.04))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.065)] backdrop-blur-xl transition-colors hover:border-[color:var(--primary)]/35 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:p-5"
                      key={item.productId}
                      layout
                      initial={{ opacity: 0, y: 24, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -24, scale: 0.96 }}
                      transition={{ duration: 0.35, ease: sectionEase }}
                    >
                      <div className="relative aspect-[1.25] overflow-hidden rounded-[1rem] sm:aspect-square">
                        <Image
                          alt={item.name}
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                          fill
                          sizes="8rem"
                          src={item.image}
                        />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl font-semibold leading-tight">{item.name}</h2>
                        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                          {formatCurrency(item.price, locale)} each
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <div className="inline-grid h-11 grid-cols-[2.5rem_3rem_2.5rem] overflow-hidden rounded-full border border-white/12 bg-white/[0.04]">
                          <button
                            aria-label={`Decrease ${item.name}`}
                            className="flex items-center justify-center text-[color:var(--text-muted)] transition-colors hover:bg-white/[0.08] hover:text-[color:var(--primary-light)]"
                            onClick={() => decreaseQuantity(item.productId)}
                            type="button"
                          >
                            <Minus aria-hidden="true" size={15} />
                          </button>
                          <span className="flex items-center justify-center border-x border-white/10 text-sm font-bold">
                            {item.quantity}
                          </span>
                          <button
                            aria-label={`Increase ${item.name}`}
                            className="flex items-center justify-center text-[color:var(--text-muted)] transition-colors hover:bg-white/[0.08] hover:text-[color:var(--primary-light)]"
                            onClick={() => increaseQuantity(item.productId)}
                            type="button"
                          >
                            <Plus aria-hidden="true" size={15} />
                          </button>
                          </div>
                          <span className="rounded-full border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/8 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[color:var(--gold)] uppercase">
                            Prepared fresh
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                        <div className="text-2xl font-semibold text-[color:var(--primary-light)]">
                          {formatCurrency(item.price * item.quantity, locale)}
                        </div>
                        <button
                          className="inline-flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[color:var(--text-muted)] transition-all hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
                          onClick={() => removeItem(item.productId)}
                          type="button"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 aria-hidden="true" size={17} />
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>
                </div>
              </div>

              <aside className="lg:sticky lg:top-28">
                <div className="relative overflow-hidden rounded-[1.6rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.035)_54%,rgba(255,122,0,0.07))] p-6 shadow-[0_34px_110px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
                  <div className="pointer-events-none absolute -right-20 -top-20 size-52 rounded-full bg-[color:var(--primary)]/18 blur-3xl" />
                  <div className="relative">
                    <h2 className="text-2xl font-semibold">Order Summary</h2>
                    <div className="mt-6 divide-y divide-white/10 text-sm">
                      <div className="flex justify-between py-4 text-[color:var(--text-muted)]">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal, locale)}</span>
                      </div>
                      <div className="flex justify-between py-4 text-[color:var(--text-muted)]">
                        <span>Delivery Fee</span>
                        <span>{formatCurrency(deliveryFee, locale)}</span>
                      </div>
                      <div className="flex justify-between py-4 text-[color:var(--text-muted)]">
                        <span>Estimated Prep</span>
                        <span>25 - 35 min</span>
                      </div>
                      <div className="flex justify-between py-5 text-lg font-semibold">
                        <span>Total</span>
                        <span className="text-[color:var(--primary-light)]">
                          {formatCurrency(total, locale)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/8 px-4 py-3 text-xs leading-6 text-[color:var(--text-muted)]">
                      Kitchen receives this as a frontend-ready order summary for future API integration.
                    </div>
                    <Link
                      className="mt-4 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-7 text-sm font-bold text-[color:var(--background)] shadow-[0_20px_56px_rgba(255,122,0,0.36)] transition-transform hover:-translate-y-0.5"
                      href={routes.checkout}
                    >
                      Proceed To Checkout
                    </Link>
                    <button
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
                      onClick={clearCart}
                      type="button"
                    >
                      Clear Cart
                    </button>
                  </div>
                </div>
              </aside>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
