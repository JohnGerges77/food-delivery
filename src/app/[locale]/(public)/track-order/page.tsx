import { OrderTrackingCard } from "@/components/features/orders/OrderTrackingCard";
import { PageHeader } from "@/components/common/PageHeader";
import type { Locale } from "@/i18n/routing";
import { getOrders } from "@/services/order-service";
import { getTranslations } from "next-intl/server";

export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("pages.trackOrder");
  const latestOrder = getOrders(locale)[0];

  return (
    <main className="space-y-8 p-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <OrderTrackingCard order={latestOrder} />
    </main>
  );
}
