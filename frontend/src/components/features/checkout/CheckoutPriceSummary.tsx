import { publicMoney } from "@/lib/public-menu-presentation";

export function CheckoutPriceSummary({ currency, deliveryFee, locale, minimumOrder, ordering, subtotal }: {
  currency: string;
  deliveryFee: number | null;
  locale: string;
  minimumOrder: number | null;
  ordering: boolean;
  subtotal: number;
}) {
  const ar = locale === "ar";
  const fee = deliveryFee ?? 0;
  const money = (amount: number) => publicMoney(amount, currency, locale);

  return (
    <dl className="mt-6 divide-y divide-white/10 text-sm">
      <div className="flex justify-between gap-2 py-4 text-[color:var(--text-muted)]">
        <dt>{ar ? "المجموع الفرعي" : "Subtotal"}</dt>
        <dd>{money(subtotal)}</dd>
      </div>
      {ordering && <>
        <div className="flex justify-between gap-2 py-4 text-[color:var(--text-muted)]">
          <dt>{ar ? "رسوم التوصيل" : "Delivery fee"}</dt>
          <dd>{money(fee)}</dd>
        </div>
        {minimumOrder !== null && minimumOrder > 0 && (
          <div className="flex justify-between gap-2 py-4 text-[color:var(--text-muted)]">
            <dt>{ar ? "الحد الأدنى للطلب" : "Minimum order"}</dt>
            <dd>{money(minimumOrder)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2 py-5 text-lg font-semibold">
          <dt>{ar ? "إجمالي تقديري" : "Provisional total"}</dt>
          <dd className="text-[color:var(--primary-light)]">{money(subtotal + fee)}</dd>
        </div>
      </>}
    </dl>
  );
}
