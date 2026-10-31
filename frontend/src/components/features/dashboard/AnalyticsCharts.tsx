"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId, useState } from "react";
import type { Breakdown, TrendBucket } from "@/services/owner-analytics-service";

const colors = ["#ff9200", "#67d6c0", "#ffd36d", "#7aaef5", "#b49bf5", "#f08f9c"];
const number = (n: number, locale: string) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 0 }).format(n);
export const money = (n: number, currency: string, locale: string) => {
  try { return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "currency", currency }).format(n); }
  catch { return `${number(n, locale)} ${currency}`; }
};

export function Sparkline({ points }: { points: { value: number }[] }) {
  if (points.length < 2) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  const coords = points.map((p, i) => `${(i / (points.length - 1)) * 100},${29 - (p.value / max) * 25}`).join(" ");
  return <svg aria-hidden="true" className="mt-3 h-7 w-full" viewBox="0 0 100 32" preserveAspectRatio="none"><polyline points={coords} fill="none" stroke="#ff9200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function bucketLabel(value: string, granularity: "day" | "week" | "month", locale: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    timeZone: "UTC", month: "short", day: granularity === "month" ? undefined : "numeric", year: granularity === "month" ? "numeric" : undefined,
  }).format(date);
}

export function AreaChart({ rows, granularity, locale, currency, kind }: {
  rows: TrendBucket[]; granularity: "day" | "week" | "month"; locale: string; currency: string; kind: "orders" | "value";
}) {
  const [active, setActive] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const id = useId().replaceAll(":", "");
  const series = kind === "orders" ? [
    { key: "ordersCreated" as const, label: locale === "ar" ? "طلبات أُنشئت" : "Orders created", color: colors[0] },
    { key: "ordersDelivered" as const, label: locale === "ar" ? "طلبات سُلّمت" : "Orders delivered", color: colors[1] },
  ] : [{ key: "deliveredOrderValue" as const, label: locale === "ar" ? "قيمة الطلبات المسلّمة" : "Delivered order value", color: colors[0] }];
  const max = Math.max(1, ...rows.flatMap((row) => series.map((item) => row[item.key])));
  const x = (i: number) => 44 + (i / Math.max(1, rows.length - 1)) * 652;
  const y = (n: number) => 226 - (n / max) * 184;
  const line = (key: typeof series[number]["key"]) => rows.map((row, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(row[key]).toFixed(2)}`).join(" ");
  const area = (key: typeof series[number]["key"]) => rows.length ? `${line(key)} L${x(rows.length - 1)} 226 L${x(0)} 226 Z` : "";
  const selected = active === null ? null : rows[active];
  const sample = rows.length <= 5 ? rows : rows.filter((_, i) => i === 0 || i === rows.length - 1 || i % Math.max(1, Math.floor(rows.length / 4)) === 0);
  return <div className="relative mt-6" aria-label={kind === "orders" ? "Orders performance chart" : "Delivered order value chart"} role="group">
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[color:var(--text-muted)]">
      {series.map((item) => <span key={item.key} className="inline-flex items-center gap-2"><i className="size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
    </div>
    <svg className="mt-2 h-64 w-full overflow-visible" viewBox="0 0 740 258" preserveAspectRatio="none" role="img" aria-label={`${rows.length} UTC ${granularity} buckets. ${series.map((s) => `${s.label}: ${rows.reduce((sum, r) => sum + r[s.key], 0)}`).join("; ")}`}>
      <defs>{series.map((s) => <linearGradient id={`${id}-${s.key}`} x1="0" x2="0" y1="0" y2="1" key={s.key}><stop offset="0%" stopColor={s.color} stopOpacity=".32" /><stop offset="100%" stopColor={s.color} stopOpacity=".015" /></linearGradient>)}</defs>
      {[0, 0.25, 0.5, 0.75, 1].map((step) => <g key={step}><line x1="44" x2="696" y1={y(max * step)} y2={y(max * step)} stroke="rgba(255,255,255,.11)" strokeDasharray="3 5" /><text x="38" y={y(max * step) + 4} textAnchor="end" fill="#a9a29b" fontSize="11">{kind === "value" ? number(max * step, locale) : number(Math.round(max * step), locale)}</text></g>)}
      {series.map((s) => <g key={s.key}><motion.path d={area(s.key)} fill={`url(#${id}-${s.key})`} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} /><motion.path d={line(s.key)} fill="none" stroke={s.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.55, ease: "easeOut" }} /></g>)}
      {selected && active !== null ? <line x1={x(active)} x2={x(active)} y1="42" y2="226" stroke="rgba(255,255,255,.4)" strokeDasharray="4 4" /> : null}
      {rows.map((row, i) => <rect key={`hit-${row.bucketStart}`} x={rows.length === 1 ? 44 : x(i) - 326 / (rows.length - 1)} y="42" width={652 / Math.max(1, rows.length - 1)} height="184" fill="transparent" aria-hidden="true" onPointerEnter={() => setActive(i)} onClick={() => setActive(active === i ? null : i)} />)}
      {rows.map((row, i) => <circle key={row.bucketStart} cx={x(i)} cy={y(row[series[0].key])} r={active === i ? 6 : 4} fill={series[0].color} stroke="#17120e" strokeWidth="2" tabIndex={0} role="button" aria-label={`${bucketLabel(row.date, granularity, locale)}: ${series.map((s) => `${s.label} ${kind === "value" ? money(row[s.key], currency, locale) : number(row[s.key], locale)}`).join(", ")}`} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === i ? null : i)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActive(i); } }} />)}
      {sample.map((row) => <text key={row.bucketStart} x={x(rows.indexOf(row))} y="251" textAnchor="middle" fill="#a9a29b" fontSize="11">{bucketLabel(row.date, granularity, locale)}</text>)}
    </svg>
    {selected ? <div className="pointer-events-none absolute right-1 top-10 z-10 rounded-xl border border-white/15 bg-[#201c1a] px-4 py-3 text-xs shadow-2xl sm:right-4" role="status">
      <strong className="block text-white">{bucketLabel(selected.date, granularity, locale)} UTC</strong>
      {series.map((s) => <span key={s.key} className="mt-1 block text-[color:var(--text-muted)]">{s.label}: {kind === "value" ? money(selected[s.key], currency, locale) : number(selected[s.key], locale)}</span>)}
    </div> : null}
  </div>;
}

export function DonutChart({ slices, total, locale, labels }: { slices: Breakdown[]; total: number; locale: string; labels: Record<string, string> }) {
  const [active, setActive] = useState<string | null>(null);
  return <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
    <div className="relative size-44 shrink-0">
      <svg viewBox="0 0 180 180" className="size-full -rotate-90" role="img" aria-label={`${number(total, locale)} total orders`}>
        <circle cx="90" cy="90" r="68" stroke="rgba(255,255,255,.08)" strokeWidth="17" fill="none" />
        {slices.map((s, i) => { const length = total ? (s.count / total) * 427 : 0; const start = total ? slices.slice(0, i).reduce((sum, item) => sum + item.count, 0) / total * 427 : 0; return length ? <circle key={s.key} cx="90" cy="90" r="68" fill="none" stroke={colors[i]} strokeWidth="17" strokeDasharray={`${Math.max(0, length - 2)} ${427 - Math.max(0, length - 2)}`} strokeDashoffset={-start} strokeLinecap="round" tabIndex={0} role="button" aria-label={`${labels[s.key]}: ${number(s.count, locale)} (${s.percentage}%)`} onFocus={() => setActive(s.key)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === s.key ? null : s.key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActive(s.key); } }} /> : null; })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"><strong className="text-3xl">{number(active ? slices.find((s) => s.key === active)?.count ?? 0 : total, locale)}</strong><span className="max-w-24 text-xs text-[color:var(--text-muted)]">{active ? labels[active] : locale === "ar" ? "إجمالي الطلبات" : "Total orders"}</span></div>
    </div>
    <div className="grid min-w-0 w-full gap-2">{slices.map((s, i) => <div key={s.key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs hover:bg-white/[.04]" onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)}><span className="flex items-center gap-2"><i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[i] }} />{labels[s.key]}</span><span className="whitespace-nowrap text-[color:var(--text-muted)]">{number(s.count, locale)} · {number(s.percentage, locale)}%</span></div>)}</div>
  </div>;
}

export function ActivityHeatmap({ cells, locale }: { cells: { weekday: number; hour: number; orders: number }[]; locale: string }) {
  const days = locale === "ar" ? ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const max = Math.max(1, ...cells.map((c) => c.orders));
  return <div className="mt-6 overflow-x-auto pb-2" role="group" aria-label={locale === "ar" ? "نشاط الطلبات بحسب اليوم والساعة بتوقيت UTC" : "Order activity by weekday and UTC hour"}>
    <div className="min-w-[680px]"><div className="mb-2 grid grid-cols-[4.5rem_repeat(24,minmax(0,1fr))] gap-1 text-center text-[10px] text-[color:var(--text-muted)]"><span>UTC</span>{Array.from({ length: 24 }, (_, h) => <span key={h}>{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>)}</div>
      {days.map((day, d) => <div key={day} className="mb-1 grid grid-cols-[4.5rem_repeat(24,minmax(0,1fr))] gap-1"><span className="truncate text-xs text-[color:var(--text-muted)]">{day}</span>{cells.slice(d * 24, d * 24 + 24).map((c) => <button key={c.hour} type="button" className="aspect-square min-w-0 rounded-[4px] border border-white/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-400" style={{ backgroundColor: c.orders ? `rgba(255,146,0,${0.2 + 0.8 * c.orders / max})` : "rgba(255,255,255,.05)" }} title={`${day} ${String(c.hour).padStart(2, "0")}:00 UTC · ${number(c.orders, locale)} ${locale === "ar" ? "طلب" : "orders"}`} aria-label={`${day} ${String(c.hour).padStart(2, "0")}:00 UTC: ${number(c.orders, locale)} ${locale === "ar" ? "طلب" : "orders"}`} />)}</div>)}
    </div>
  </div>;
}
