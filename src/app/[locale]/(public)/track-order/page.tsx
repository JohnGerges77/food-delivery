import { OrderTrackingCard } from "@/components/features/orders/OrderTrackingCard";
import { PageHeader } from "@/components/common/PageHeader";
import Footer from "@/components/layout/Footer.jsx";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
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

  return <>
    <PublicNavbar />
    <main className="min-h-[60vh] space-y-8 bg-[color:var(--background)] p-6 text-[color:var(--text)]">
      <PageHeader title={t("title")} description={t("description")} />
      <OrderTrackingCard order={latestOrder} />
    </main>
    <Footer />
  </>;
}
