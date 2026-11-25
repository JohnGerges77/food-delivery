"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { adminRestaurant, setAdminRestaurantOrdering, setAdminRestaurantStatus, setAdminRestaurantTheme, type PlatformRestaurant,
  PlatformApiError } from "@/services/platform-admin-service";

export function AdminRestaurantDetails({ id }: { id: string }) {
  const locale = useLocale(); const ar = locale === "ar";
  const [data, setData] = useState<PlatformRestaurant | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<PlatformRestaurant["storefrontTheme"]>("savora-classic");
  const [themeSaved, setThemeSaved] = useState(false);
  const [orderingSelection, setOrderingSelection] = useState(false);
  const [orderingSaved, setOrderingSaved] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { let active = true;
    adminRestaurant(id).then((result) => { if (active) { setData(result.restaurant); setSelectedTheme(result.restaurant.storefrontTheme); setOrderingSelection(result.restaurant.onlineOrderingEnabled !== false); setLoading(false); setError(""); } })
      .catch(() => { if (active) { setLoading(false); setError(ar ? "تعذّر تحميل المطعم" : "Could not load restaurant"); } });
    return () => { active = false; };
  }, [id, ar, refresh]);
  async function changeStatus() {
    if (!data || busy) return;
    setBusy(true); setError("");
    try { const result = await setAdminRestaurantStatus(id, data.status === "active" ? "suspended" : "active");
      setData(result.restaurant); setConfirm(false);
    } catch (cause) {
      setError(cause instanceof PlatformApiError && cause.status === 409 ?
        (ar ? "الحالة تغيّرت. أعد تحميل الصفحة." : "Status changed. Refresh this page.") :
        (ar ? "تعذّر تغيير الحالة." : "Could not change status."));
    } finally { setBusy(false); }
  }
  async function changeTheme() {
    if (!data || busy || selectedTheme === data.storefrontTheme) return;
    setBusy(true); setError(""); setThemeSaved(false);
    try { const result = await setAdminRestaurantTheme(id, selectedTheme);
      setData(result.restaurant); setSelectedTheme(result.restaurant.storefrontTheme); setThemeSaved(true);
    } catch (cause) { setError(cause instanceof PlatformApiError && cause.status === 409 ?
      (ar ? "التصميم تغيّر. أعد تحميل الصفحة." : "Theme changed. Refresh this page.") :
      (ar ? "تعذّر حفظ التصميم." : "Could not save theme."));
    } finally { setBusy(false); }
  }
  async function changeOrdering() {
    if (!data || busy || orderingSelection === (data.onlineOrderingEnabled !== false)) return;
    setBusy(true); setError(""); setOrderingSaved(false);
    try {
      const result = await setAdminRestaurantOrdering(id, orderingSelection);
      setData(result.restaurant);
      setOrderingSelection(result.restaurant.onlineOrderingEnabled !== false);
      setOrderingSaved(true);
    } catch (cause) {
      setError(cause instanceof PlatformApiError && cause.status === 409
        ? (ar ? "تغيّر وضع الطلبات. أعد تحميل الصفحة." : "Ordering mode changed. Refresh this page.")
        : (ar ? "تعذّر حفظ وضع الطلبات." : "Could not save ordering mode."));
    } finally { setBusy(false); }
  }
  return <div className="max-w-4xl">
    <Link href={`/${locale}/admin/restaurants`} className="text-sm text-orange-300">← {ar ? "المطاعم" : "Restaurants"}</Link>
    {loading ? <p className="mt-8" aria-live="polite">{ar ? "جارٍ التحميل…" : "Loading…"}</p> :
      !data ? <p role="alert" className="mt-8">{error} <button onClick={() => { setLoading(true); setRefresh(refresh + 1); }} className="text-orange-400">{ar ? "إعادة المحاولة" : "Retry"}</button></p> : <>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.25em] text-orange-400">SAVORA / PLATFORM</p><h1 className="mt-2 text-3xl font-extrabold">{data.name}</h1><p className="mt-2 text-white/55" dir="ltr">/{data.slug}</p></div><span className="rounded-full border border-orange-400/40 px-4 py-2 text-orange-300">{data.status === "active" ? (ar ? "نشط" : "Active") : (ar ? "معلّق" : "Suspended")}</span></div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2"><section className="rounded-2xl border border-white/10 bg-[#171a22] p-6"><h2 className="text-lg font-bold text-orange-300">{ar ? "المطعم" : "Restaurant"}</h2><p className="mt-4">{ar ? "العملة" : "Currency"}: {data.currency}</p><p className="mt-3 text-white/60">{data.description || "—"}</p></section><section className="rounded-2xl border border-white/10 bg-[#171a22] p-6"><h2 className="text-lg font-bold text-orange-300">{ar ? "المالك" : "Owner"}</h2><p className="mt-4">{data.owner?.name ?? "—"}</p><p className="mt-2 text-white/60" dir="ltr">{data.owner?.email ?? "—"}</p><p className="mt-2 text-sm text-white/50">{data.owner?.isActive ? (ar ? "الحساب نشط" : "Account active") : (ar ? "الحساب غير متاح" : "Account unavailable")}</p></section></div>
        <section className="mt-4 rounded-2xl border border-white/10 bg-[#171a22] p-6"><h2 className="text-lg font-bold text-orange-300">{ar ? "تصميم واجهة المطعم" : "Storefront theme"}</h2><p className="mt-2 text-sm text-white/60">{ar ? "التصميم الحالي:" : "Current theme:"} {data.storefrontTheme === "savora-aqua" ? "Savora Aqua" : data.storefrontTheme === "savora-cafe" ? "Savora Café" : data.storefrontTheme === "savora-luxury" ? "Savora Luxury" : "Savora Classic"}</p><div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm">{ar ? "اختر التصميم" : "Choose theme"}<select value={selectedTheme} onChange={(event) => { setSelectedTheme(event.target.value as PlatformRestaurant["storefrontTheme"]); setThemeSaved(false); }} className="mt-2 block min-h-11 rounded-xl border border-white/20 bg-[#0e1118] px-4"><option value="savora-classic">Savora Classic</option><option value="savora-aqua">Savora Aqua</option><option value="savora-cafe">Savora Café</option><option value="savora-luxury">Savora Luxury</option></select></label><button type="button" disabled={busy || selectedTheme === data.storefrontTheme} onClick={changeTheme} className="min-h-11 rounded-xl bg-orange-500 px-5 font-bold text-black disabled:opacity-45">{busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التصميم" : "Save theme")}</button>{data.status === "active" && <Link href={`/${locale}/r/${data.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-5 text-orange-300">{ar ? "معاينة الواجهة" : "Preview storefront"}</Link>}</div>{themeSaved && <p role="status" className="mt-3 text-sm text-emerald-300">{ar ? "تم حفظ التصميم." : "Theme saved."}</p>}</section>
        <section className="mt-4 rounded-2xl border border-white/10 bg-[#171a22] p-6" data-testid="ordering-entitlement">
          <h2 className="text-lg font-bold text-orange-300">{ar ? "الطلبات عبر الإنترنت" : "Online ordering"}</h2>
          <p className="mt-2 text-sm text-white/70">{data.onlineOrderingEnabled === false
            ? (ar ? "منيو رقمية فقط" : "Digital Menu Only")
            : (ar ? "منيو وطلبات عبر الإنترنت" : "Menu + Online Ordering")}</p>
          <p className="mt-2 text-sm text-white/60">{ar
            ? "يحدد هذا الخيار ما إذا كان المطعم يمكنه استقبال طلبات جديدة. يظل سجل الطلبات متاحًا للمالك."
            : "This setting controls new online orders. The owner keeps access to order history."}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">{ar ? "وضع واجهة المطعم" : "Storefront mode"}
              <select value={String(orderingSelection)} disabled={busy}
                onChange={(event) => { setOrderingSelection(event.target.value === "true"); setOrderingSaved(false); }}
                className="mt-2 block min-h-11 max-w-full rounded-xl border border-white/20 bg-[#0e1118] px-4">
                <option value="false">{ar ? "منيو رقمية فقط" : "Digital Menu Only"}</option>
                <option value="true">{ar ? "منيو وطلبات عبر الإنترنت" : "Menu + Online Ordering"}</option>
              </select>
            </label>
            <button type="button" disabled={busy || orderingSelection === (data.onlineOrderingEnabled !== false)}
              onClick={changeOrdering} className="min-h-11 rounded-xl bg-orange-500 px-5 font-bold text-black disabled:opacity-45">
              {ar ? "حفظ وضع الطلبات" : "Save ordering mode"}
            </button>
          </div>
          {orderingSaved && <p role="status" className="mt-3 text-sm text-emerald-300">{ar ? "تم حفظ وضع الطلبات." : "Ordering mode saved."}</p>}
        </section>
        {error && <p role="alert" className="mt-5 text-red-300">{error}</p>}
        <button onClick={() => setConfirm(true)} className="mt-7 rounded-xl border border-orange-500 px-5 py-3 text-orange-300">{data.status === "active" ? (ar ? "تعليق المطعم" : "Suspend restaurant") : (ar ? "تفعيل المطعم" : "Activate restaurant")}</button>
        {confirm && <div role="dialog" aria-modal="true" aria-label={ar ? "تأكيد تغيير الحالة" : "Confirm status change"} className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#171a22] p-7 shadow-2xl"><h2 className="text-xl font-bold">{data.status === "active" ? (ar ? "تعليق المطعم؟" : "Suspend restaurant?") : (ar ? "تفعيل المطعم؟" : "Activate restaurant?")}</h2><p className="mt-3 text-white/60">{data.status === "active" ? (ar ? "سيتوقف الطلب الجديد ودخول المالك لحين إعادة التفعيل." : "New orders and owner access will stop until reactivation.") : (ar ? "سيعود الوصول إلى المطعم." : "Access to the restaurant will resume.")}</p>{error && <p role="alert" className="mt-4 text-red-300">{error}</p>}<div className="mt-6 flex gap-3"><button autoFocus disabled={busy} onClick={changeStatus} className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-black disabled:opacity-50">{ar ? "تأكيد" : "Confirm"}</button><button disabled={busy} onClick={() => setConfirm(false)} className="rounded-xl border border-white/20 px-5 py-3">{ar ? "إلغاء" : "Cancel"}</button></div></div></div>}
      </>}
  </div>;
}
