"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { adminOverview } from "@/services/platform-admin-service";

export function AdminOverview() {
  const locale = useLocale(); const ar = locale === "ar";
  const [data, setData] = useState<{ total: number; active: number; suspended: number } | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => { let active = true;
    adminOverview().then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [version]);
  return <div>
    <p className="text-xs font-bold tracking-[.25em] text-orange-400">SAVORA / PLATFORM</p>
    <h1 className="mt-3 text-3xl font-extrabold">{ar ? "نظرة عامة على المنصة" : "Platform overview"}</h1>
    <p className="mt-2 text-white/50">{ar ? "حالة المطاعم الحقيقية" : "Current restaurant status"}</p>
    {error ? <div role="alert" className="mt-8 rounded-2xl border border-red-400/30 p-6">{ar ? "تعذّر تحميل البيانات" : "Could not load data"} <button className="ms-4 text-orange-400" onClick={() => { setError(false); setVersion(version + 1); }}>{ar ? "إعادة المحاولة" : "Retry"}</button></div> :
      !data ? <p className="mt-8" aria-live="polite">{ar ? "جارٍ التحميل…" : "Loading…"}</p> :
      <div className="mt-8 grid gap-4 sm:grid-cols-3">{([
        [ar ? "إجمالي المطاعم" : "Total restaurants", data.total],
        [ar ? "نشطة" : "Active", data.active],
        [ar ? "معلّقة" : "Suspended", data.suspended],
      ] as const).map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#171a22] p-7"><p className="text-sm text-white/60">{label}</p><p className="mt-4 text-5xl font-black text-orange-400">{value}</p></div>)}</div>}
    <div className="mt-8 flex flex-wrap gap-3">
      <Link className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-black" href={`/${locale}/admin/restaurants/new`}>{ar ? "إضافة مطعم" : "Add restaurant"}</Link>
      <Link className="rounded-xl border border-white/20 px-5 py-3" href={`/${locale}/admin/restaurants`}>{ar ? "عرض المطاعم" : "View restaurants"}</Link>
    </div>
  </div>;
}
