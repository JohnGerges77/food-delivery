import { DashboardOverview } from "@/components/features/dashboard/DashboardOverview";
import { PageHeader } from "@/components/common/PageHeader";
import type { Locale } from "@/i18n/routing";
import { getDashboardStats, getRecentOrders } from "@/services/dashboard-service";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("pages.dashboard");
  const stats = getDashboardStats();
  const recentOrders = getRecentOrders(locale);

  return (
    <section className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <DashboardOverview stats={stats} recentOrders={recentOrders} />
    </section>
  );
}
