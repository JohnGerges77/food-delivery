import { PageHeader } from "@/components/common/PageHeader";
import { OrderCard } from "@/components/features/orders/OrderCard";
import type { Locale } from "@/i18n/routing";
import { getOrders } from "@/services/order-service";
import { getTranslations } from "next-intl/server";

export default async function OrdersManagementPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("pages.orders");
  const orders = getOrders(locale);

  return (
    <section className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <div className="grid gap-4">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </section>
  );
}
