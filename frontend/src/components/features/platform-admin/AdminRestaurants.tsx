"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { adminRestaurants, type PlatformList } from "@/services/platform-admin-service";

export function AdminRestaurants() {
  const locale = useLocale(); const ar = locale === "ar";
  const [search, setSearch] = useState(""); const [term, setTerm] = useState("");
  const [page, setPage] = useState(1); const [data, setData] = useState<PlatformList | null>(null);
  const [error, setError] = useState(false); const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { const controller = new AbortController();
    adminRestaurants(page, term, controller.signal).then((value) => { setData(value); setError(false); setLoading(false); })
      .catch(() => { if (!controller.signal.aborted) { setError(true); setLoading(false); } });
    return () => controller.abort();
  }, [page, term, refresh]);
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div>
      <p className="text-xs font-bold tracking-[.25em] text-orange-400">SAVORA / PLATFORM</p>
      <h1 className="mt-3 text-3xl font-extrabold">{ar ? "المطاعم" : "Restaurants"}</h1>
    </div><Link href={`/${locale}/admin/restaurants/new`} className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-black">{ar ? "إضافة مطعم" : "Add restaurant"}</Link></div>
    <form className="mt-8 flex max-w-xl gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setLoading(true); setTerm(search.trim()); }}>
      <input aria-label={ar ? "بحث" : "Search"} value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} placeholder={ar ? "ابحث بالاسم أو الرابط" : "Search name or slug"} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#171a22] px-4 py-3 outline-none focus:border-orange-400" />
      <button className="rounded-xl border border-orange-500 px-5 py-3 text-orange-300">{ar ? "بحث" : "Search"}</button>
    </form>
    {loading ? <p className="mt-8" aria-live="polite">{ar ? "جارٍ التحميل…" : "Loading…"}</p> : error ? <p role="alert" className="mt-8">{ar ? "تعذّر تحميل المطاعم" : "Could not load restaurants"} <button className="text-orange-400" onClick={() => { setLoading(true); setRefresh(refresh + 1); }}>{ar ? "إعادة المحاولة" : "Retry"}</button></p> :
      <><div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-[#171a22]">
        {data?.restaurants.length ? <table className="w-full min-w-[700px] text-start text-sm"><thead className="bg-white/5 text-white/55"><tr>{(ar ? ["المطعم", "الرابط", "المالك", "التصميم", "الحالة"] : ["Restaurant", "Slug", "Owner", "Theme", "Status"]).map((label) => <th key={label} className="px-5 py-4 text-start">{label}</th>)}</tr></thead><tbody>{data.restaurants.map((item) => <tr key={item.id} className="border-t border-white/10"><td className="px-5 py-4"><Link href={`/${locale}/admin/restaurants/${item.id}`} className="font-bold text-orange-300 hover:underline">{item.name}</Link></td><td className="px-5 py-4" dir="ltr">{item.slug}</td><td className="px-5 py-4" dir="ltr">{item.owner?.email ?? "—"}</td><td className="px-5 py-4">{item.storefrontTheme === "savora-aqua" ? "Savora Aqua" : item.storefrontTheme === "savora-cafe" ? "Savora Café" : item.storefrontTheme === "savora-luxury" ? "Savora Luxury" : "Savora Classic"}</td><td className="px-5 py-4">{item.status === "active" ? (ar ? "نشط" : "Active") : (ar ? "معلّق" : "Suspended")}</td></tr>)}</tbody></table> : <p className="p-8 text-white/60">{ar ? "لا توجد مطاعم" : "No restaurants found"}</p>}</div>
        <div className="mt-5 flex items-center gap-4"><button disabled={page <= 1} onClick={() => { setLoading(true); setPage(page - 1); }} className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40">{ar ? "السابق" : "Previous"}</button><span>{page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 20))}</span><button disabled={page * 20 >= (data?.total ?? 0)} onClick={() => { setLoading(true); setPage(page + 1); }} className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40">{ar ? "التالي" : "Next"}</button></div>
      </>}
  </div>;
}
