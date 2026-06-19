import { DashboardOrdersPage } from "@/components/features/dashboard/DashboardOrdersPage";
import type { Locale } from "@/i18n/routing";
import { getOrders } from "@/services/order-service";

export default async function OrdersManagementPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const orders = getOrders(locale);

  return <DashboardOrdersPage orders={orders} />;
}
