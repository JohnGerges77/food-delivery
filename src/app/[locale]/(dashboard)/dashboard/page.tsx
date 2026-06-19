import { DashboardHomePage } from "@/components/features/dashboard/DashboardHomePage";
import type { Locale } from "@/i18n/routing";
import { getDashboardStats, getRecentOrders, getTopProducts } from "@/services/dashboard-service";
import { getProducts } from "@/services/product-service";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const stats = getDashboardStats();
  const recentOrders = getRecentOrders(locale);
  const topProducts = getTopProducts(locale);
  const products = getProducts(locale);

  return (
    <DashboardHomePage
      stats={stats}
      recentOrders={recentOrders}
      topProducts={topProducts}
      products={products}
    />
  );
}
