import { ApiError, apiRequest } from "./api-client.ts";

export type AnalyticsPeriod = "7d" | "30d" | "6m" | "12m";
export type ProductRank = "quantitySold" | "deliveredItemValue";
export interface AnalyticsMeta {
  period: AnalyticsPeriod;
  from: string;
  toExclusive: string;
  granularity: "day" | "week" | "month";
  currency: string;
}
export interface Comparison { current: number; previous: number; absoluteChange: number; percentageChange: number | null }
export interface TrendBucket { date: string; bucketStart: string; ordersCreated: number; ordersDelivered: number; deliveredOrderValue: number; averageDeliveredOrderValue: number }
export interface Overview extends AnalyticsMeta {
  totalOrders: Comparison; deliveredOrders: Comparison; pendingOrders: Comparison;
  cancelledOrders: Comparison; ordersDeliveredInPeriod: Comparison;
  deliveredOrderValue: Comparison; deliveredSubtotal: Comparison; deliveredDeliveryFees: Comparison;
  averageDeliveredOrderValue: Comparison; cancellationRate: Comparison; deliveryCompletionRate: Comparison;
  sparklines: { totalOrders: { date: string; value: number }[]; deliveredOrderValue: { date: string; value: number }[] };
}
export interface Trends extends AnalyticsMeta { series: TrendBucket[]; previousSeries: TrendBucket[] }
export interface Breakdown { key: string; label: string; count: number; percentage: number }
export interface Breakdowns extends AnalyticsMeta { totalOrders: number; submissionMethods: Breakdown[]; statuses: Breakdown[] }
export interface RankedProduct { rank: number; productId: string; productName: string; quantitySold: number; deliveredItemValue: number }
export interface TopProducts extends AnalyticsMeta { rankBy: ProductRank; limit: 5 | 10 | 20; products: RankedProduct[]; mostFrequentlyOrderedProduct: { productId: string; productName: string } | null }
export interface ActivityCell { weekday: number; hour: number; orders: number }
export interface Activity extends AnalyticsMeta {
  totalOrders: number; cells: ActivityCell[];
  insights: { busiestWeekday: { weekday: number; orders: number } | null;
    busiestHour: { hour: number; orders: number } | null;
    highestActivityCell: ActivityCell | null };
}
export type AnalyticsSection = "overview" | "trends" | "top-products" | "breakdowns" | "activity";
export interface AnalyticsData { overview: Overview; trends: Trends; "top-products": TopProducts; breakdowns: Breakdowns; activity: Activity }

const fail = (): never => { throw new ApiError(null, "Invalid analytics response"); };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fail();
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : fail();
const number = (value: unknown): number => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fail();
const signedNumber = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : fail();
const integer = (value: unknown): number => { const n = number(value); return Number.isInteger(n) ? n : fail(); };
const string = (value: unknown): string => typeof value === "string" && value.length > 0 ? value : fail();
const date = (value: unknown): string => { const s = string(value); const parsed = new Date(`${s}T00:00:00.000Z`); return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s ? s : fail(); };
const timestamp = (value: unknown): string => { const s = string(value); return /^\d{4}-\d{2}-\d{2}T.*Z$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : fail(); };
const oneOf = <T extends string>(value: unknown, choices: readonly T[]): T => choices.includes(value as T) ? value as T : fail();
const comparison = (value: unknown): Comparison => { const v = record(value); return { current: number(v.current), previous: number(v.previous), absoluteChange: signedNumber(v.absoluteChange), percentageChange: v.percentageChange === null ? null : signedNumber(v.percentageChange) }; };
const meta = (value: Record<string, unknown>, period: AnalyticsPeriod): AnalyticsMeta => ({
  period: value.period === period ? period : fail(), from: timestamp(value.from),
  toExclusive: timestamp(value.toExclusive), granularity: oneOf(value.granularity, ["day", "week", "month"] as const),
  currency: /^[A-Z]{3}$/.test(string(value.currency)) ? value.currency as string : fail(),
});
const bucket = (value: unknown): TrendBucket => { const v = record(value); return { date: date(v.date), bucketStart: timestamp(v.bucketStart), ordersCreated: integer(v.ordersCreated), ordersDelivered: integer(v.ordersDelivered), deliveredOrderValue: number(v.deliveredOrderValue), averageDeliveredOrderValue: number(v.averageDeliveredOrderValue) }; };
function chronological(values: unknown): TrendBucket[] {
  const rows = array(values).map(bucket);
  if (rows.some((row, i) => i > 0 && row.bucketStart <= rows[i - 1].bucketStart)) fail();
  return rows;
}
const slice = (value: unknown): Breakdown => { const v = record(value); return { key: string(v.key), label: string(v.label), count: integer(v.count), percentage: number(v.percentage) }; };
const cell = (value: unknown): ActivityCell => { const v = record(value); const weekday = integer(v.weekday), hour = integer(v.hour); if (weekday > 6 || hour > 23) fail(); return { weekday, hour, orders: integer(v.orders) }; };

export function parseAnalytics<K extends AnalyticsSection>(section: K, value: unknown, period: AnalyticsPeriod): AnalyticsData[K] {
  const v = record(value), shared = meta(v, period);
  if (section === "overview") {
    const keys = ["totalOrders", "deliveredOrders", "pendingOrders", "cancelledOrders", "ordersDeliveredInPeriod", "deliveredOrderValue", "deliveredSubtotal", "deliveredDeliveryFees", "averageDeliveredOrderValue", "cancellationRate", "deliveryCompletionRate"] as const;
    const metrics = Object.fromEntries(keys.map((key) => [key, comparison(v[key])])) as Record<typeof keys[number], Comparison>;
    const sparks = record(v.sparklines);
    const points = (x: unknown) => array(x).map((item) => { const p = record(item); return { date: date(p.date), value: number(p.value) }; });
    return { ...shared, ...metrics, sparklines: { totalOrders: points(sparks.totalOrders), deliveredOrderValue: points(sparks.deliveredOrderValue) } } as AnalyticsData[K];
  }
  if (section === "trends") return { ...shared, series: chronological(v.series), previousSeries: chronological(v.previousSeries) } as AnalyticsData[K];
  if (section === "breakdowns") {
    const methods = array(v.submissionMethods).map(slice), statuses = array(v.statuses).map(slice);
    if (methods.length !== 2 || methods.map((x) => x.key).join(",") !== "direct,whatsapp" || statuses.map((x) => x.key).join(",") !== "pending,delivered,cancelled" || statuses.reduce((sum, x) => sum + x.count, 0) !== v.totalOrders) fail();
    return { ...shared, totalOrders: integer(v.totalOrders), submissionMethods: methods, statuses } as AnalyticsData[K];
  }
  if (section === "top-products") {
    const products = array(v.products).map((item) => { const p = record(item); return { rank: integer(p.rank), productId: string(p.productId), productName: string(p.productName), quantitySold: integer(p.quantitySold), deliveredItemValue: number(p.deliveredItemValue) }; });
    const frequent = v.mostFrequentlyOrderedProduct === null ? null : record(v.mostFrequentlyOrderedProduct);
    const limit = v.limit === 5 || v.limit === 10 || v.limit === 20 ? v.limit : fail();
    if (products.length > limit) fail();
    return { ...shared, rankBy: oneOf(v.rankBy, ["quantitySold", "deliveredItemValue"] as const), limit, products,
      mostFrequentlyOrderedProduct: frequent ? { productId: string(frequent.productId), productName: string(frequent.productName) } : null } as AnalyticsData[K];
  }
  const cells = array(v.cells).map(cell), insights = record(v.insights);
  if (cells.length !== 168 || cells.some((c, i) => c.weekday !== Math.floor(i / 24) || c.hour !== i % 24)) fail();
  const day = insights.busiestWeekday === null ? null : record(insights.busiestWeekday);
  const hour = insights.busiestHour === null ? null : record(insights.busiestHour);
  return { ...shared, totalOrders: integer(v.totalOrders), cells,
    insights: { busiestWeekday: day ? { weekday: integer(day.weekday), orders: integer(day.orders) } : null,
      busiestHour: hour ? { hour: integer(hour.hour), orders: integer(hour.orders) } : null,
      highestActivityCell: insights.highestActivityCell === null ? null : cell(insights.highestActivityCell) } } as AnalyticsData[K];
}

export async function getOwnerAnalytics<K extends AnalyticsSection>(section: K, period: AnalyticsPeriod,
  options: { signal?: AbortSignal; limit?: 5 | 10; rankBy?: ProductRank } = {}): Promise<AnalyticsData[K]> {
  const params = new URLSearchParams({ period });
  if (section === "top-products") { params.set("limit", String(options.limit ?? 5)); params.set("rankBy", options.rankBy ?? "quantitySold"); }
  const response = await apiRequest<unknown>(`/api/owner/stats/${section}?${params}`, { signal: options.signal });
  const parsed = parseAnalytics(section, response, period);
  if (section === "top-products" && ((parsed as TopProducts).limit !== (options.limit ?? 5) || (parsed as TopProducts).rankBy !== (options.rankBy ?? "quantitySold"))) fail();
  return parsed;
}

export function comparisonLabel(metric: Comparison, locale: string): string {
  if (metric.percentageChange === null) return locale === "ar" ? "لا توجد مقارنة سابقة" : "No previous-period comparison";
  const sign = metric.percentageChange > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { maximumFractionDigits: 2 }).format(metric.percentageChange)}%`;
}
