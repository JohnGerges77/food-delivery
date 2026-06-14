import { dashboardStats, topProducts } from "@/data/dashboard";
import { localizeOrder, localizeTopProduct } from "@/data/localized";
import { orders } from "@/data/orders";
import type { Locale } from "@/i18n/routing";

export function getDashboardStats() {
  return dashboardStats;
}

export function getRecentOrders(locale?: Locale) {
  return orders.slice(0, 5).map((order) => localizeOrder(order, locale));
}

export function getTopProducts(locale?: Locale) {
  return topProducts.map((product) => localizeTopProduct(product, locale));
}
