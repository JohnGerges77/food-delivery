"use client";

import { motion } from "framer-motion";
import {
  ClipboardList,
  MapPin,
  Phone,
  ShoppingBag,
  User,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { publicMoney } from "@/lib/public-menu-presentation";
import { PublicProductImage } from "@/components/features/storefront/PublicProductImage";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";
import { useCartStore } from "@/store/cart-store";
import { buildCheckoutPayload, checkoutValidation, GuestCheckoutCoordinator, GuestCheckoutError,
  type CheckoutErrors, type GuestCheckoutResult, type SubmissionMethod } from "@/services/guest-checkout-service";
import { emptyCheckoutDetails, updateCheckoutDetail, type CheckoutDetails } from "./checkout-details";

const sectionEase = [0.16, 1, 0.3, 1] as const;

const fields = [
  { name: "fullName", label: "Full Name", type: "text", icon: User },
  { name: "phone", label: "Phone Number", type: "tel", icon: Phone },
  { name: "address", label: "Address", type: "text", icon: MapPin },
  { name: "city", label: "City", type: "text", icon: MapPin },
] as const;

export function CheckoutOrderingPage({ deliveryFee, currency, slug }: {
  deliveryFee: number | null; currency: string; slug: string;
}) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { restaurant, href } = useStorefront();
  const cartItems = useCartStore((state) => state.items);
  const tenantSlug = useCartStore((state) => state.tenantSlug);
  const items = tenantSlug === slug ? cartItems : [];
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal + (deliveryFee ?? 0);
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);
  const [details, setDetails] = useState<CheckoutDetails>(emptyCheckoutDetails);
  const [step, setStep] = useState(0);
  const whatsappAvailable = /^https:\/\/wa\.me\/[1-9][0-9]{6,14}$/.test(restaurant.socialLinks.whatsapp ?? "");
  const [method, setMethod] = useState<SubmissionMethod>(whatsappAvailable ? "whatsapp" : "direct");
  const [handoffBlocked, setHandoffBlocked] = useState(false);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [failure, setFailure] = useState<{ status: number | null; message: string; uncertain: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmation, setConfirmation] = useState<GuestCheckoutResult | null>(null);
  const coordinator = useRef(new GuestCheckoutCoordinator());
  const submitting = useRef(false);

  function updateDetail(field: keyof CheckoutDetails, value: string) {
    setDetails((current) => updateCheckoutDetail(current, field, value));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || confirmation) return;
    const nextErrors = checkoutValidation(details, items);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || tenantSlug !== slug) {
      if (tenantSlug !== slug) setErrors((current) => ({ ...current, cart: "cart" }));
      setStep(0);
      return;
    }
    if (step < 2) { setStep(step + 1); return; }
    submitting.current = true;
    setSending(true);
    setFailure(null);
    try {
      const payload = buildCheckoutPayload(details, items, method);
      const result = await coordinator.current.submit(slug, payload);
      setConfirmation(result);
      if (result.order.submissionMethod === "whatsapp" && result.whatsapp) {
        try {
          const opened = window.open("", "_blank");
          if (!opened) setHandoffBlocked(true);
          else {
            opened.opener = null;
            opened.location.replace(result.whatsapp.url);
          }
        } catch { setHandoffBlocked(true); }
      }
      const currentCart = useCartStore.getState();
      if (currentCart.tenantSlug === slug && JSON.stringify(currentCart.items.map((item) => [item.productId, item.quantity, item.notes])) ===
        JSON.stringify(items.map((item) => [item.productId, item.quantity, item.notes]))) currentCart.clearCart();
    } catch (error) {
      const checkoutError = error instanceof GuestCheckoutError ? error :
        new GuestCheckoutError(null, "The result is unknown. Retry with the same details to recover your order.", true);
      setFailure({ status: checkoutError.status, message: checkoutError.message, uncertain: checkoutError.uncertain });
    } finally { submitting.current = false; setSending(false); }
  }

  function fieldError(field: keyof CheckoutDetails) {
    if (!errors[field]) return null;
    if (isArabic) return field === "phone" ? "أدخل رقم هاتف صالحًا." : "راجع هذه البيانات؛ الحقل مطلوب أو أطول من المسموح.";
    return field === "phone" ? "Enter a valid phone number." : "Check this field; it is required or too long.";
  }

  function failureMessage() {
    if (!failure) return "";
    if (!isArabic) return failure.message;
    if (failure.uncertain) return "نتيجة الطلب غير مؤكدة. أعد المحاولة بنفس البيانات لاستعادة التأكيد؛ ربما تم حفظه بالفعل.";
    if (failure.status === 401 || failure.status === 403) return "رُفض الوصول لإتمام الطلب. تأكد من صلاحية دخولك إلى النسخة التجريبية ثم أعد المحاولة.";
    if (failure.status === 404) return "هذا المطعم غير متاح حاليًا.";
    if (failure.status === 409) return "تعذر إتمام الطلب: قد توجد محاولة سابقة متعارضة، أو أن المنتج أو التوصيل أو WhatsApp غير متاح. راجع البيانات قبل إعادة المحاولة.";
    if (failure.status === 429) return "محاولات كثيرة جدًا. انتظر قليلًا ثم أعد المحاولة.";
    return "تعذر حفظ الطلب. راجع البيانات وتوفر المنتجات والتوصيل، ثم أعد المحاولة.";
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
              {isArabic ? `راجع تفاصيل طلبك من ${restaurant.name} وأكده كضيف.` : `Review and place your guest order from ${restaurant.name}.`}
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
            onSubmit={handleSubmit}
            noValidate
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
                  href={href("/cart")}
                >
                  {isArabic ? "العودة إلى السلة" : "Back To Cart"}
                </Link>
              </div>

              <div className="mt-8 grid gap-3 rounded-[1.1rem] border border-white/10 bg-[color:var(--background)]/32 p-4 sm:grid-cols-3">
                {(isArabic ? ["التفاصيل", "المراجعة", "الإرسال"] : ["Details", "Review", "Submit"]).map((label, index) => (
                  <div className="flex items-center gap-3" key={label}>
                    <span
                      className={`flex size-9 items-center justify-center rounded-full border text-sm font-bold ${
                        index === step
                          ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--background)]"
                          : "border-white/12 bg-white/[0.04] text-[color:var(--text-muted)]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-[color:var(--text)]">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {confirmation ? (
                <div className="mt-8 rounded-[1rem] border border-[color:var(--primary)]/35 bg-[color:var(--primary)]/10 p-6" role="status" data-testid="checkout-confirmation">
                  <h3 className="text-2xl font-semibold text-[color:var(--primary-light)]">{isArabic ? "تم حفظ الطلب" : "Order saved successfully"}</h3>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--text-muted)]">{isArabic ? "رقم الطلب" : "Order reference"}: <strong className="text-[color:var(--text)]">{confirmation.order.orderNumber}</strong></p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">{isArabic ? "الإجمالي المؤكد" : "Confirmed total"}: <strong className="text-[color:var(--text)]">{publicMoney(confirmation.order.total, confirmation.order.currency, locale)}</strong></p>
                  {confirmation.order.submissionMethod === "whatsapp" ? <>
                    <p className="mt-4 text-sm leading-7 text-[color:var(--text)]">{handoffBlocked ? (isArabic ? "تعذّر فتح WhatsApp تلقائيًا. افتحه من الزر بالأسفل وأرسل الرسالة بنفسك." : "WhatsApp could not open automatically. Use the button below and send the message yourself.") : (isArabic ? "فتح WhatsApp لا يعني إرسال الرسالة. راجعها وأرسلها بنفسك." : "Opening WhatsApp does not send the message. Review and send it yourself.")}</p>
                    <a className="mt-6 inline-flex min-h-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-8 text-sm font-bold text-[color:var(--background)]" href={confirmation.whatsapp!.url} target="_blank" rel="noopener noreferrer">{isArabic ? "فتح WhatsApp" : "Open WhatsApp"}</a>
                  </> : <p className="mt-4 text-sm leading-7 text-[color:var(--text-muted)]">{isArabic ? "استلم المطعم طلبك في Savora. لم يتم تأكيد الدفع." : "Your order is saved in Savora. Payment has not been confirmed."}</p>}
                </div>
              ) : <>
              {step === 0 && <>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {fields.map((field) => {
                  const Icon = field.icon;
                  const fieldLabel = isArabic
                    ? ({fullName: "الاسم", phone: "رقم الهاتف", address: "عنوان التوصيل", city: "المدينة"} as Record<string, string>)[field.name]
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
                          aria-invalid={Boolean(errors[field.name])}
                          value={details[field.name]}
                          onChange={(event) => updateDetail(field.name, event.currentTarget.value)}
                          placeholder={fieldLabel}
                          type={field.type}
                        />
                      </span>
                      {fieldError(field.name) && <span className="mt-2 block text-xs text-[color:var(--primary-light)]" role="alert">{fieldError(field.name)}</span>}
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
                    aria-invalid={Boolean(errors.notes)}
                    value={details.notes}
                    onChange={(event) => updateDetail("notes", event.currentTarget.value)}
                    placeholder={isArabic ? "الحساسية أو تعليمات التوصيل أو أي شيء يجب أن يعرفه المطبخ." : "Allergies, delivery instructions, or anything our kitchen should know."}
                  />
                  {fieldError("notes") && <span className="mt-2 block text-xs text-[color:var(--primary-light)]" role="alert">{fieldError("notes")}</span>}
                </label>
              </div>
              </>}

              {step === 1 && <div className="mt-8 rounded-[1rem] border border-white/10 bg-[color:var(--background)]/32 p-5 text-sm leading-7" data-testid="checkout-review">
                <h3 className="text-xl font-semibold">{isArabic ? "مراجعة البيانات" : "Review your details"}</h3>
                <dl className="mt-4 grid gap-2 text-[color:var(--text-muted)]">
                  <div><dt className="inline font-semibold text-[color:var(--gold)]">{isArabic ? "الاسم" : "Name"}: </dt><dd className="inline">{details.fullName}</dd></div>
                  <div><dt className="inline font-semibold text-[color:var(--gold)]">{isArabic ? "الهاتف" : "Phone"}: </dt><dd className="inline">{details.phone}</dd></div>
                  <div><dt className="inline font-semibold text-[color:var(--gold)]">{isArabic ? "العنوان" : "Address"}: </dt><dd className="inline">{details.address}, {details.city}</dd></div>
                  {details.notes && <div><dt className="inline font-semibold text-[color:var(--gold)]">{isArabic ? "ملاحظات" : "Notes"}: </dt><dd className="inline">{details.notes}</dd></div>}
                </dl>
                <button className="mt-5 text-sm font-semibold text-[color:var(--primary-light)] hover:underline" onClick={() => setStep(0)} type="button">{isArabic ? "تعديل البيانات" : "Edit details"}</button>
              </div>}

              {step === 2 && <div className="mt-8 rounded-[1rem] border border-white/10 bg-[color:var(--background)]/32 p-5" data-testid="checkout-methods">
                <h3 className="text-xl font-semibold">{isArabic ? "طريقة إرسال الطلب" : "Submission method"}</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {(["whatsapp", "direct"] as const).filter((option) => option === "direct" || whatsappAvailable).map((option) => <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[1rem] border px-4 text-sm font-semibold ${method === option ? "border-[color:var(--primary)]/70 bg-[color:var(--primary)]/10" : "border-white/10 bg-white/[0.04]"}`} key={option}>
                    <input checked={method === option} disabled={sending} name="submissionMethod" onChange={() => setMethod(option)} type="radio" value={option} />
                    {option === "direct" ? (isArabic ? "مباشر" : "Direct") : "WhatsApp"}
                  </label>)}
                </div>
                {!whatsappAvailable && <p className="mt-3 text-sm text-[color:var(--text-muted)]">{isArabic ? "WhatsApp غير مهيأ لهذا المطعم؛ يمكنك حفظ الطلب مباشرة." : "WhatsApp is not configured for this restaurant; you can place the order directly."}</p>}
                <p className="mt-5 text-sm leading-7 text-[color:var(--text-muted)]">{isArabic ? "سيؤكد الخادم السعر النهائي عند حفظ الطلب. فتح WhatsApp لا يعني إرسال الرسالة." : "The server confirms the final price when saving. Opening WhatsApp does not send the message."}</p>
                <button className="mt-4 text-sm font-semibold text-[color:var(--primary-light)] hover:underline" disabled={sending} onClick={() => setStep(1)} type="button">{isArabic ? "العودة للمراجعة" : "Back to review"}</button>
              </div>}

              {errors.cart && <p className="mt-6 rounded-lg border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 p-4 text-sm text-[color:var(--primary-light)]" role="alert">{isArabic ? "راجع السلة: يجب اختيار منتجات صالحة وكميات مسموحة من هذا المطعم." : "Check your cart: select valid products and quantities from this restaurant."}</p>}
              {failure && <p className="mt-6 rounded-lg border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 p-4 text-sm leading-7 text-[color:var(--text)]" role="alert" data-testid="checkout-error">{failureMessage()}</p>}
              <p className="mt-7 rounded-lg border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/8 p-4 text-sm leading-7 text-[color:var(--text-muted)]" role="status">
                {isArabic ? "المبالغ المعروضة تقديرية حتى يؤكد الخادم الطلب. لا يُحفظ الطلب إلا بعد خطوة الإرسال." : "Displayed amounts are provisional until the server confirms the order. Nothing is saved until you submit."}
              </p>
              <button
                className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-8 text-sm font-bold text-[color:var(--background)] shadow-[0_22px_62px_rgba(255,122,0,0.38)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                disabled={sending || items.length === 0 || tenantSlug !== slug}
                type="submit"
              >
                {sending ? (isArabic ? "جارٍ حفظ الطلب..." : "Saving order...") : step === 0 ? (isArabic ? "مراجعة الطلب" : "Review Order") : step === 1 ? (isArabic ? "المتابعة للإرسال" : "Continue to Submit") : (isArabic ? "تأكيد وحفظ الطلب" : "Confirm and Save Order")}
              </button>
              </>}
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
                      href={href("/menu")}
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
                            <PublicProductImage
                              alt={item.name}
                              className="object-cover"
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
                            {publicMoney(item.price * item.quantity, currency, locale)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-lg border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/8 p-4">
                      <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                        {isArabic ? "معلومات التوصيل" : "Delivery Information"}
                      </div>
                      <div className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                        {restaurant.deliverySettings.deliveryAvailable
                          ? restaurant.deliverySettings.estimatedDeliveryTime || (isArabic ? "لم يحدد المطعم وقتًا تقديريًا للتوصيل." : "The restaurant has not listed a delivery estimate.")
                          : (isArabic ? "التوصيل غير متاح حاليًا." : "Delivery is currently unavailable.")}
                      </div>
                    </div>
                    <div className="mt-6 divide-y divide-white/10 text-sm">
                      <div className="flex justify-between py-4 text-[color:var(--text-muted)]">
                        <span>{isArabic ? "المجموع الفرعي" : "Subtotal"}</span>
                        <span>{publicMoney(subtotal, currency, locale)}</span>
                      </div>
                      <div className="flex justify-between py-4 text-[color:var(--text-muted)]">
                        <span>{isArabic ? "رسوم التوصيل" : "Delivery Fee"}</span>
                        <span>{deliveryFee === null ? "—" : publicMoney(deliveryFee, currency, locale)}</span>
                      </div>
                      <div className="flex justify-between py-5 text-lg font-semibold">
                        <span>{isArabic ? "إجمالي تقديري" : "Provisional Total"}</span>
                        <span className="text-[color:var(--primary-light)]">
                          {deliveryFee === null ? "—" : publicMoney(total, currency, locale)}
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
    </main>
  );
}

