"use client";

import { Activity as ActivityIcon, ArrowDownRight, ArrowUpRight, DollarSign, Package, RefreshCw, ShoppingBag, Timer, TrendingUp, Utensils } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { ApiError } from "@/services/api-client";
import { listOwnerOrders, operationalOrderStatus, ownerOrderDate, ownerOrderStatusLabel, type OwnerOrder, type OwnerOrderStatusGroup } from "@/services/owner-orders-service";
import { comparisonLabel, getOwnerAnalytics, type Activity, type AnalyticsPeriod, type Breakdowns, type Overview, type ProductRank, type TopProducts, type Trends } from "@/services/owner-analytics-service";
import { useAuthStore } from "@/store/auth-store";
import { ActionButton, DashboardCard, StatusBadge } from "./DashboardUI";
import { ActivityHeatmap, AreaChart, DonutChart, Sparkline, money } from "./AnalyticsCharts";

type Section = "overview" | "trends" | "breakdowns" | "activity";
type SectionData = { overview: Overview; trends: Trends; breakdowns: Breakdowns; activity: Activity };
type Entry<T> = { period: AnalyticsPeriod; value?: T; error?: boolean };
type DashboardData = { [K in Section]?: Entry<SectionData[K]> };
const periods: AnalyticsPeriod[] = ["7d", "30d", "6m", "12m"];
const sections: Section[] = ["overview", "trends", "breakdowns", "activity"];
const statusKeys: OwnerOrderStatusGroup[] = ["pending", "delivered", "cancelled"];
const copy = {
  en: { title: "Overview", context: "Live owner analytics", period: "Reporting period (UTC)", refresh: "Refresh", retry: "Retry", failed: "Could not load this section.", orders: "Total Orders", value: "Delivered Order Value", pending: "Pending Orders", average: "Average Delivered Order Value", delivered: "Delivered Orders", cancelled: "Cancelled Orders", completion: "Delivery Completion Rate", performance: "Orders Performance", performanceInfo: "Created by order date · delivered by delivery date", valueInfo: "Value at delivery date · operational value, not verified payments", statuses: "Current Order Status", statusInfo: "Current status of orders created in this period", methods: "Order Submission Methods", methodsInfo: "Saved Direct or WhatsApp orders; WhatsApp send is unconfirmed", products: "Top Products", productsInfo: "Delivered item snapshots; value excludes delivery fees", noProducts: "No delivered products yet", activity: "Order Activity", activityInfo: "Order creation by weekday and hour · UTC", busiestDay: "Busiest day", busiestHour: "Busiest hour", none: "No activity yet", recent: "Recent Orders", recentInfo: "Latest guest orders flowing through the kitchen.", allOrders: "View All Orders", noOrders: "No orders yet", quantity: "Quantity", itemValue: "Item value", top5: "Top 5", top10: "Top 10", previous: "Previous period" },
  ar: { title: "نظرة عامة", context: "تحليلات المالك المباشرة", period: "فترة التقرير (UTC)", refresh: "تحديث", retry: "إعادة المحاولة", failed: "تعذّر تحميل هذا القسم.", orders: "إجمالي الطلبات", value: "قيمة الطلبات المسلّمة", pending: "طلبات قيد الانتظار", average: "متوسط قيمة الطلب المسلّم", delivered: "طلبات مسلّمة", cancelled: "طلبات ملغاة", completion: "معدل إتمام التوصيل", performance: "أداء الطلبات", performanceInfo: "الإنشاء حسب تاريخ الطلب · التسليم حسب تاريخ التسليم", valueInfo: "القيمة حسب تاريخ التسليم · ليست مدفوعات مؤكدة", statuses: "حالات الطلبات الحالية", statusInfo: "الحالة الحالية للطلبات المنشأة في هذه الفترة", methods: "طرق إرسال الطلبات", methodsInfo: "طلبات محفوظة مباشرة أو عبر واتساب؛ إرسال واتساب غير مؤكّد", products: "المنتجات الأفضل", productsInfo: "عناصر الطلبات المسلّمة المحفوظة؛ القيمة بدون رسوم التوصيل", noProducts: "لا توجد منتجات مسلّمة بعد", activity: "نشاط الطلبات", activityInfo: "إنشاء الطلبات حسب اليوم والساعة · UTC", busiestDay: "أنشط يوم", busiestHour: "أنشط ساعة", none: "لا يوجد نشاط بعد", recent: "أحدث الطلبات", recentInfo: "أحدث طلبات الضيوف في المطبخ.", allOrders: "كل الطلبات", noOrders: "لا توجد طلبات بعد", quantity: "الكمية", itemValue: "قيمة العناصر", top5: "أول 5", top10: "أول 10", previous: "الفترة السابقة" },
};
const periodLabels = { en: { "7d": "Last 7 Days", "30d": "Last 30 Days", "6m": "Last 6 Months", "12m": "Last 12 Months" }, ar: { "7d": "آخر 7 أيام", "30d": "آخر 30 يومًا", "6m": "آخر 6 أشهر", "12m": "آخر 12 شهرًا" } };
const count = (n: number, locale: string) => new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { maximumFractionDigits: 2 }).format(n);
const weekdays = { en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], ar: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"] };
function utcWindow(from: string, toExclusive: string, locale: string) {
  const f = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
  return `${f.format(new Date(from))} – ${f.format(new Date(Date.parse(toExclusive) - 86_400_000))} UTC`;
}
const stateOf = (entry: Entry<unknown> | undefined, period: AnalyticsPeriod): "loading" | "error" | "ready" => !entry || entry.period !== period ? "loading" : entry.error ? "error" : entry.value ? "ready" : "loading";
function SectionFrame({ children, state, retry, error }: { children: React.ReactNode; state: "loading" | "error" | "ready"; retry: () => void; error: string }) {
  return <DashboardCard className="p-5 sm:p-6"><div className="min-h-72" aria-busy={state === "loading"}>{state === "loading" ? <div className="motion-safe:animate-pulse space-y-5" aria-label="Loading analytics"><div className="h-6 w-44 rounded bg-white/10" /><div className="h-52 rounded-2xl bg-white/[.05]" /></div> : state === "error" ? <div className="grid min-h-64 place-content-center gap-4 text-center"><p className="text-[color:var(--text-muted)]">{error}</p><ActionButton onClick={retry} variant="ghost">Retry</ActionButton></div> : children}</div></DashboardCard>;
}
export function DashboardHomePage() {
  const context = useAuthStore((s) => s.context);
  if (!context) return null;
  return <AnalyticsView key={`${context.user.id}:${context.restaurant.id}:${context.restaurant.currency}`} restaurant={context.restaurant.name} currency={context.restaurant.currency} />;
}
function AnalyticsView({ restaurant, currency }: { restaurant: string; currency: string }) {
  const locale = useLocale() === "ar" ? "ar" : "en"; const t = copy[locale];
  const restore = useAuthStore((s) => s.restore);
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<DashboardData>({});
  const [rankBy, setRankBy] = useState<ProductRank>("quantitySold");
  const [limit, setLimit] = useState<5 | 10>(5);
  const [top, setTop] = useState<(Entry<TopProducts> & { rankBy: ProductRank; limit: 5 | 10 }) | undefined>();
  const [recent, setRecent] = useState<{ orders?: OwnerOrder[]; error?: boolean }>({});
  useEffect(() => {
    const controller = new AbortController(); let cancelled = false;
    for (const section of sections) void getOwnerAnalytics(section, period, { signal: controller.signal }).then((value) => {
      if (!cancelled) setData((old) => ({ ...old, [section]: { period, value } }));
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof ApiError && error.status === 401) { void restore(); return; }
      setData((old) => ({ ...old, [section]: { period, error: true } }));
    });
    return () => { cancelled = true; controller.abort(); };
  }, [period, revision, restore]);
  useEffect(() => {
    const controller = new AbortController(); let cancelled = false;
    void getOwnerAnalytics("top-products", period, { signal: controller.signal, rankBy, limit }).then((value) => {
      if (!cancelled) setTop({ period, rankBy, limit, value });
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof ApiError && error.status === 401) { void restore(); return; }
      setTop({ period, rankBy, limit, error: true });
    });
    return () => { cancelled = true; controller.abort(); };
  }, [period, rankBy, limit, revision, restore]);
  useEffect(() => {
    let cancelled = false;
    void listOwnerOrders({ page: 1, limit: 5 }).then((result) => { if (!cancelled) setRecent({ orders: result.orders }); }).catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof ApiError && error.status === 401) { void restore(); return; }
      setRecent({ error: true });
    });
    return () => { cancelled = true; };
  }, [revision, restore]);
  const refresh = () => { setData({}); setTop(undefined); setRecent({}); setRevision((n) => n + 1); };
  const overview = data.overview?.period === period ? data.overview.value : undefined;
  const trends = data.trends?.period === period ? data.trends.value : undefined;
  const breakdowns = data.breakdowns?.period === period ? data.breakdowns.value : undefined;
  const activity = data.activity?.period === period ? data.activity.value : undefined;
  const topReady = top?.period === period && top.rankBy === rankBy && top.limit === limit ? top : undefined;
  const matches = (value: { from: string; toExclusive: string; currency: string } | undefined) => !!value && value.currency === currency && (!overview || (overview.from === value.from && overview.toExclusive === value.toExclusive));
  const state = (section: Section) => stateOf(data[section], period);
  const overviewState = state("overview") === "ready" && overview?.currency !== currency ? "error" : state("overview");
  const visualState = (entryState: "loading" | "error" | "ready", value: { from: string; toExclusive: string; currency: string } | undefined) => entryState === "ready" && !matches(value) ? "error" : entryState;
  const cards = overview ? [
    { title: t.orders, metric: overview.totalOrders, icon: ShoppingBag, format: (n: number) => count(n, locale), spark: overview.sparklines.totalOrders },
    { title: t.value, metric: overview.deliveredOrderValue, icon: DollarSign, format: (n: number) => money(n, currency, locale), spark: overview.sparklines.deliveredOrderValue },
    { title: t.pending, metric: overview.pendingOrders, icon: Timer, format: (n: number) => count(n, locale) },
    { title: t.average, metric: overview.averageDeliveredOrderValue, icon: TrendingUp, format: (n: number) => money(n, currency, locale) },
    { title: locale === "ar" ? "معدل الإلغاء" : "Cancellation Rate", metric: overview.cancellationRate, icon: ActivityIcon, format: (n: number) => `${count(n, locale)}%` },
    { title: t.delivered, metric: overview.ordersDeliveredInPeriod, icon: Package, format: (n: number) => count(n, locale) },
    { title: t.cancelled, metric: overview.cancelledOrders, icon: ActivityIcon, format: (n: number) => count(n, locale) },
    { title: t.completion, metric: overview.deliveryCompletionRate, icon: TrendingUp, format: (n: number) => `${count(n, locale)}%` },
  ] : [];
  return <section className="space-y-6">
    <div className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025)_58%,rgba(255,122,0,0.04))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:p-6 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-semibold tracking-[0.22em] text-[color:var(--gold)] uppercase">{t.context}</p><h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{t.title}</h2><p className="mt-2 text-sm text-[color:var(--text-muted)]">{restaurant} · {overview ? utcWindow(overview.from, overview.toExclusive, locale) : t.period}</p></div><div className="flex flex-wrap items-center gap-2"><div role="group" aria-label={t.period} className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-black/20 p-1">{periods.map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={`min-h-10 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${period === p ? "bg-[color:var(--primary)] text-[color:var(--background)]" : "text-[color:var(--text-muted)] hover:text-white"}`}>{periodLabels[locale][p]}</button>)}</div><ActionButton variant="ghost" onClick={refresh} aria-label={t.refresh}><RefreshCw size={16} aria-hidden="true" />{t.refresh}</ActionButton></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">{overviewState === "ready" && overview ? cards.map((card) => { const Icon = card.icon, change = card.metric.percentageChange; return <div key={card.title} className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.026)_60%,rgba(255,122,0,0.04))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="text-xs font-semibold tracking-[0.14em] text-[color:var(--gold)] uppercase">{card.title}</div><div className={`mt-3 break-words font-semibold ${card.title === t.value || card.title === t.average ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>{card.format(card.metric.current)}</div></div><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]"><Icon size={21} aria-hidden="true" /></span></div><div className="mt-4 flex items-center gap-1 text-xs text-[color:var(--text-muted)]">{change !== null && change > 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : change !== null && change < 0 ? <ArrowDownRight size={14} aria-hidden="true" /> : null}{comparisonLabel(card.metric, locale)}</div><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{t.previous}: {card.format(card.metric.previous)}</p>{"spark" in card && card.spark ? <Sparkline points={card.spark} /> : null}</div>; }) : overviewState === "error" ? <div className="rounded-[1.35rem] border border-white/10 bg-white/[.04] p-5 sm:col-span-2 xl:col-span-4"><p>{t.failed}</p><ActionButton variant="ghost" onClick={refresh}>{t.retry}</ActionButton></div> : Array.from({ length: 8 }, (_, i) => <div key={i} className="min-h-36 motion-safe:animate-pulse rounded-[1.35rem] border border-white/10 bg-white/[.04] p-5">{state("overview") === "error" && i === 0 ? <><p>{t.failed}</p><ActionButton variant="ghost" onClick={refresh}>{t.retry}</ActionButton></> : null}</div>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><SectionFrame state={visualState(state("trends"), trends)} retry={refresh} error={t.failed}><h3 className="text-2xl font-semibold">{t.performance}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{t.performanceInfo}</p>{trends && matches(trends) ? <AreaChart rows={trends.series} granularity={trends.granularity} currency={currency} locale={locale} kind="orders" /> : null}</SectionFrame><SectionFrame state={visualState(stateOf(topReady, period), topReady?.value)} retry={refresh} error={t.failed}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-2xl font-semibold">{t.products}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{t.productsInfo}</p></div><Package className="text-[color:var(--primary-light)]" size={22} /></div><div className="mt-5 flex flex-wrap gap-2"><select aria-label={t.products} className="rounded-lg border border-white/10 bg-[#241f1b] px-3 py-2 text-xs" value={rankBy} onChange={(e) => setRankBy(e.target.value as ProductRank)}><option value="quantitySold">{t.quantity}</option><option value="deliveredItemValue">{t.itemValue}</option></select><select aria-label="Top product count" className="rounded-lg border border-white/10 bg-[#241f1b] px-3 py-2 text-xs" value={limit} onChange={(e) => setLimit(Number(e.target.value) as 5 | 10)}><option value="5">{t.top5}</option><option value="10">{t.top10}</option></select></div><div className="mt-4 grid gap-3">{topReady?.value?.products.length ? topReady.value.products.map((p) => <div key={p.productId} className="grid grid-cols-[4rem_1fr_auto] items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex aspect-square items-center justify-center rounded-xl bg-[color:var(--primary)]/10 text-[color:var(--primary-light)]"><Utensils size={22} aria-hidden="true" /></div><div className="min-w-0"><div className="truncate font-semibold">#{p.rank} {p.productName}</div><div className="mt-1 text-sm text-[color:var(--text-muted)]">{count(p.quantitySold, locale)} {t.quantity}</div></div><div className="text-end text-sm font-semibold text-[color:var(--primary-light)]">{money(p.deliveredItemValue, currency, locale)}</div></div>) : <p className="rounded-xl border border-white/10 p-5 text-sm text-[color:var(--text-muted)]">{t.noProducts}</p>}</div></SectionFrame></div>
    <SectionFrame state={visualState(state("trends"), trends)} retry={refresh} error={t.failed}><h3 className="text-2xl font-semibold">{t.value}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{t.valueInfo}</p>{trends && matches(trends) ? <AreaChart rows={trends.series} granularity={trends.granularity} currency={currency} locale={locale} kind="value" /> : null}</SectionFrame>
    <div className="grid gap-6 lg:grid-cols-2"><SectionFrame state={visualState(state("breakdowns"), breakdowns)} retry={refresh} error={t.failed}><h3 className="text-2xl font-semibold">{t.statuses}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{t.statusInfo}</p>{breakdowns && matches(breakdowns) ? <DonutChart slices={breakdowns.statuses} total={breakdowns.totalOrders} locale={locale} labels={Object.fromEntries(statusKeys.map((key) => [key, ownerOrderStatusLabel(key, locale)]))} /> : null}</SectionFrame><SectionFrame state={visualState(state("breakdowns"), breakdowns)} retry={refresh} error={t.failed}><h3 className="text-2xl font-semibold">{t.methods}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{t.methodsInfo}</p>{breakdowns && matches(breakdowns) ? <DonutChart slices={breakdowns.submissionMethods} total={breakdowns.totalOrders} locale={locale} labels={{ direct: locale === "ar" ? "مباشر" : "Direct", whatsapp: "WhatsApp" }} /> : null}</SectionFrame></div>
    <SectionFrame state={visualState(state("activity"), activity)} retry={refresh} error={t.failed}><h3 className="text-2xl font-semibold">{t.activity}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{t.activityInfo}</p>{activity && matches(activity) ? <><ActivityHeatmap cells={activity.cells} locale={locale} /><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[color:var(--text-muted)]"><span>{t.busiestDay}: {activity.insights.busiestWeekday ? weekdays[locale][activity.insights.busiestWeekday.weekday] : t.none}</span><span>{t.busiestHour}: {activity.insights.busiestHour ? `${String(activity.insights.busiestHour.hour).padStart(2, "0")}:00 UTC` : t.none}</span></div></> : null}</SectionFrame>
    <DashboardCard className="p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-2xl font-semibold">{t.recent}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{t.recentInfo}</p></div><Link href={routes.orders}><ActionButton variant="ghost">{t.allOrders}</ActionButton></Link></div>{recent.error ? <p className="mt-6 text-sm text-[color:var(--text-muted)]">{t.failed} <button className="text-[color:var(--primary-light)] underline" onClick={refresh}>{t.retry}</button></p> : !recent.orders ? <div className="mt-6 h-36 motion-safe:animate-pulse rounded-xl bg-white/[.05]" /> : recent.orders.length === 0 ? <p className="mt-6 text-sm text-[color:var(--text-muted)]">{t.noOrders}</p> : <div className="mt-6 overflow-x-auto"><table className="min-w-[650px] w-full text-start text-sm"><thead className="text-xs font-semibold tracking-[0.16em] text-[color:var(--gold)] uppercase"><tr className="border-b border-white/10"><th className="py-3 text-start">{locale === "ar" ? "الطلب" : "Order"}</th><th className="py-3 text-start">{locale === "ar" ? "العميل" : "Customer"}</th><th className="py-3 text-start">{locale === "ar" ? "الحالة" : "Status"}</th><th className="py-3 text-start">{locale === "ar" ? "الإجمالي" : "Total"}</th><th className="py-3 text-start">{locale === "ar" ? "الوقت" : "Time"}</th></tr></thead><tbody className="divide-y divide-white/10">{recent.orders.map((order) => <tr key={order.id} className="text-[color:var(--text-muted)]"><td className="py-4 font-semibold text-[color:var(--text)]">{order.orderNumber}</td><td>{order.customerName}</td><td><StatusBadge status={operationalOrderStatus(order.status)} label={ownerOrderStatusLabel(order.status, locale)} /></td><td className="text-[color:var(--primary-light)]">{money(order.total, currency, locale)}</td><td>{ownerOrderDate(order.createdAt, locale)}</td></tr>)}</tbody></table></div>}</DashboardCard>
  </section>;
}
