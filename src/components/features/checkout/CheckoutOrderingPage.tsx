"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ClipboardList,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  User,
} from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/formatters";
import { routes } from "@/lib/routes";
import { useCartStore } from "@/store/cart-store";

const sectionEase = [0.16, 1, 0.3, 1] as const;

const fields = [
  { name: "fullName", label: "Full Name", type: "text", icon: User },
  { name: "phone", label: "Phone Number", type: "tel", icon: Phone },
  { name: "email", label: "Email", type: "email", icon: Mail },
  { name: "address", label: "Address", type: "text", icon: MapPin },
  { name: "city", label: "City", type: "text", icon: MapPin },
];

export function CheckoutOrderingPage({ deliveryFee }: { deliveryFee: number }) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const items = useCartStore((state) => state.items);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const getTotal = useCartStore((state) => state.getTotal);
  const clearCart = useCartStore((state) => state.clearCart);
  const [showSuccess, setShowSuccess] = useState(false);
  const subtotal = getSubtotal();
  const total = items.length > 0 ? getTotal(deliveryFee) : 0;
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) {
      return;
    }

    setShowSuccess(true);
    clearCart();
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]">
      <section className="relative isolate overflow-hidden px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_82%_20%,rgba(255,122,0,0.18),transparent_32%),radial-gradient(circle_at_16%_30%,rgba(212,160,23,0.1),transparent_30%),linear-gradient(135deg,rgba(31,31,31,0.86),rgba(13,13,13,1)_54%,rgba(13,13,13,1))]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-36 bg-gradient-to-t from-[color:var(--background)] to-transparent" />
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.72, ease: sectionEase }}
          >
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-[color:var(--primary-light)] uppercase shadow-[0_0_34px_rgba(255,122,0,0.14)] backdrop-blur">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-[color:var(--primary)]/80" />
              {isArabic ? "إتمام الطلب" : "Checkout"}
              <span className="size-1.5 rounded-full bg-[color:var(--primary-light)] shadow-[0_0_14px_rgba(255,157,51,0.9)]" />
            </div>
            <h1 className="max-w-4xl text-[clamp(3rem,7vw,5.6rem)] font-semibold leading-[0.95] text-balance">
              {isArabic ? "أكمل" : "Complete Your"}
              <span className="block text-[color:var(--primary-light)]">{isArabic ? "طلب الضيف" : "Guest Order"}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">
              {isArabic ? "شاركنا تفاصيل التوصيل وسنبدأ تحضير طلبك من سافورا فورًا." : "Share your delivery details and we'll prepare your Savora order shortly."}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_25rem] lg:items-start">
          <motion.form
            className="relative overflow-hidden rounded-[1.6rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.085),rgba(255,255,255,0.028)_58%,rgba(255,122,0,0.052))] p-5 shadow-[0_34px_100px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-2xl sm:p-8"
            initial={{ opacity: 0, x: -28, filter: "blur(8px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.72, ease: sectionEase }}
            onSubmit={placeOrder}
          >
            <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[color:var(--primary)]/16 blur-3xl" />
            <div className="relative">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                <span className="flex size-13 items-center justify-center rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]">
                  <ClipboardList aria-hidden="true" size={22} />
                </span>
                <div>
                  <h2 className="text-3xl font-semibold">{isArabic ? "بيانات العميل" : "Customer Information"}</h2>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                    {isArabic ? "طلب كضيف، لا حاجة إلى حساب." : "Guest checkout only. No account needed."}
                  </p>
                </div>
                </div>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
                  href={routes.cart}
                >
                  {isArabic ? "العودة إلى السلة" : "Back To Cart"}
                </Link>
              </div>

              <div className="mt-8 grid gap-3 rounded-[1.1rem] border border-white/10 bg-[color:var(--background)]/32 p-4 sm:grid-cols-3">
                {(isArabic ? ["التفاصيل", "المراجعة", "المطبخ"] : ["Details", "Review", "Kitchen"]).map((step, index) => (
                  <div className="flex items-center gap-3" key={step}>
                    <span
                      className={`flex size-9 items-center justify-center rounded-full border text-sm font-bold ${
                        index === 0
                          ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--background)]"
                          : "border-white/12 bg-white/[0.04] text-[color:var(--text-muted)]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-[color:var(--text)]">
                      {step}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {fields.map((field) => {
                  const Icon = field.icon;
                  const fieldLabel = isArabic
                    ? ({name: "الاسم", email: "البريد الإلكتروني", phone: "رقم الهاتف", address: "عنوان التوصيل"} as Record<string, string>)[field.name]
                    : field.label;

                  return (
                    <label className={field.name === "address" ? "sm:col-span-2" : ""} key={field.name}>
                      <span className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                        {fieldLabel}
                      </span>
                      <span className="relative mt-3 block">
                        <Icon
                          aria-hidden="true"
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--primary-light)]"
                          size={17}
                        />
                        <input
                          className="h-14 w-full rounded-[1rem] border border-white/10 bg-[color:var(--background)]/62 pl-12 pr-4 text-sm text-[color:var(--text)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] transition-all placeholder:text-[color:var(--text-muted)]/48 focus:border-[color:var(--primary)]/70 focus:shadow-[0_0_0_4px_rgba(255,122,0,0.13)]"
                          name={field.name}
                          placeholder={fieldLabel}
                          required={field.name !== "email"}
                          type={field.type}
                        />
                      </span>
                    </label>
                  );
                })}
                <label className="sm:col-span-2">
                  <span className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    {isArabic ? "ملاحظات" : "Notes"}
                  </span>
                  <textarea
                    className="mt-3 min-h-36 w-full resize-none rounded-[1rem] border border-white/10 bg-[color:var(--background)]/62 px-4 py-4 text-sm leading-7 text-[color:var(--text)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] transition-all placeholder:text-[color:var(--text-muted)]/48 focus:border-[color:var(--primary)]/70 focus:shadow-[0_0_0_4px_rgba(255,122,0,0.13)]"
                    name="notes"
                    placeholder={isArabic ? "الحساسية أو تعليمات التوصيل أو أي شيء يجب أن يعرفه المطبخ." : "Allergies, delivery instructions, or anything our kitchen should know."}
                  />
                </label>
              </div>

              <button
                className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-8 text-sm font-bold text-[color:var(--background)] shadow-[0_22px_62px_rgba(255,122,0,0.38)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                disabled={items.length === 0}
                type="submit"
              >
                {items.length === 0 ? (isArabic ? "أضف عناصر للمتابعة" : "Add Items To Continue") : (isArabic ? "تأكيد الطلب" : "Place Order")}
              </button>
            </div>
          </motion.form>

          <motion.aside
            className="lg:sticky lg:top-28"
            initial={{ opacity: 0, x: 28, filter: "blur(8px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.08, duration: 0.72, ease: sectionEase }}
          >
            <div className="relative overflow-hidden rounded-[1.6rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.035)_54%,rgba(255,122,0,0.07))] p-6 shadow-[0_34px_110px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute -right-20 -top-20 size-52 rounded-full bg-[color:var(--primary)]/18 blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-semibold">{isArabic ? "ملخص الطلب" : "Order Summary"}</h2>
                  <span className="rounded-full border border-[color:var(--primary)]/25 bg-[color:var(--primary)]/10 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[color:var(--primary-light)] uppercase">
                    {isArabic ? `${itemCount} عنصر` : `${itemCount} items`}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-5 text-sm leading-7 text-[color:var(--text-muted)]">
                    <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-[color:var(--primary)]/25 bg-[color:var(--primary)]/10 text-[color:var(--primary-light)]">
                      <ShoppingBag aria-hidden="true" size={21} />
                    </div>
                    {isArabic ? "سلتك فارغة. أضف بعض أطباقك المفضلة قبل تأكيد الطلب." : "Your cart is empty. Add a few favorites before placing an order."}
                    <Link
                      className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-5 text-sm font-bold text-[color:var(--background)]"
                      href={routes.menu}
                    >
                      {isArabic ? "تصفح القائمة" : "Browse Menu"}
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="mt-6 grid gap-3">
                      {items.map((item) => (
                        <div className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3" key={item.productId}>
                          <div className="relative aspect-square overflow-hidden rounded-md">
                            <Image
                              alt={item.name}
                              className="object-cover"
                              fill
                              sizes="4rem"
                              src={item.image}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{item.name}</div>
                            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                              {isArabic ? "الكمية" : "Qty"} {item.quantity}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-[color:var(--primary-light)]">
                            {formatCurrency(item.price * item.quantity, locale)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-lg border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/8 p-4">
                      <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                        {isArabic ? "موعد التوصيل" : "Delivery Window"}
                      </div>
                      <div className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                        {isArabic ? "يبدأ التحضير بعد التأكيد مباشرة. الوصول المتوقع خلال 35 - 45 دقيقة." : "Prepared shortly after confirmation. Estimated arrival in 35 - 45 minutes."}
                      </div>
                    </div>
                    <div className="mt-6 divide-y divide-white/10 text-sm">
                      <div className="flex justify-between py-4 text-[color:var(--text-muted)]">
                        <span>{isArabic ? "المجموع الفرعي" : "Subtotal"}</span>
                        <span>{formatCurrency(subtotal, locale)}</span>
                      </div>
                      <div className="flex justify-between py-4 text-[color:var(--text-muted)]">
                        <span>{isArabic ? "رسوم التوصيل" : "Delivery Fee"}</span>
                        <span>{formatCurrency(deliveryFee, locale)}</span>
                      </div>
                      <div className="flex justify-between py-5 text-lg font-semibold">
                        <span>{isArabic ? "الإجمالي" : "Total"}</span>
                        <span className="text-[color:var(--primary-light)]">
                          {formatCurrency(total, locale)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.aside>
        </div>
      </section>

      <AnimatePresence>
        {showSuccess ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/72 px-4 py-6 backdrop-blur-md"
            data-lenis-prevent
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={isArabic ? "تم تأكيد الطلب بنجاح" : "Order successfully placed"}
          >
            <motion.div
              className="relative w-full max-w-lg overflow-hidden rounded-[1.7rem] border border-white/12 bg-[linear-gradient(145deg,rgba(31,31,31,0.98),rgba(13,13,13,0.98)_56%,rgba(255,122,0,0.08))] p-8 text-center shadow-[0_42px_140px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.08)]"
              initial={{ opacity: 0, scale: 0.94, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              transition={{ duration: 0.32, ease: sectionEase }}
            >
              <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-[color:var(--primary)]/20 blur-3xl" />
              <div className="relative">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)] shadow-[0_0_42px_rgba(255,122,0,0.24)]">
                  <CheckCircle2 aria-hidden="true" size={36} />
                </div>
                <h2 className="mt-7 text-3xl font-semibold">{isArabic ? "تم تأكيد الطلب بنجاح" : "Order Successfully Placed"}</h2>
                <p className="mt-4 text-sm leading-7 text-[color:var(--text-muted)]">
                  {isArabic ? "شكرًا لاختيارك سافورا. استلمنا طلبك وسيتم تحضيره قريبًا." : "Thank you for choosing Savora. Your order has been received and will be prepared shortly."}
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <Link
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/[0.045] px-6 text-sm font-bold text-[color:var(--text)] transition-colors hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
                    href={routes.home}
                    onClick={() => setShowSuccess(false)}
                  >
                    {isArabic ? "متابعة التصفح" : "Continue Browsing"}
                  </Link>
                  <Link
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-6 text-sm font-bold text-[color:var(--background)] shadow-[0_18px_48px_rgba(255,122,0,0.32)]"
                    href={routes.menu}
                    onClick={() => setShowSuccess(false)}
                  >
                    {isArabic ? "عرض القائمة" : "View Menu"}
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
