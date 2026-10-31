import { RecentOrders } from "@/components/features/dashboard/RecentOrders";
import { StatCard } from "@/components/features/dashboard/StatCard";
import { formatCurrency } from "@/lib/formatters";
import type { DashboardStats, Order } from "@/types";
import { useLocale, useTranslations } from "next-intl";

export function DashboardOverview({
  stats,
  recentOrders,
}: {
  stats: DashboardStats;
  recentOrders: Order[];
}) {
  const t = useTranslations("components");
  const locale = useLocale();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("totalOrders")} value={stats.totalOrders} />
        <StatCard label={t("pendingOrders")} value={stats.pendingOrders} />
        <StatCard label={t("revenueToday")} value={formatCurrency(stats.revenueToday, locale)} />
        <StatCard
          label={t("averagePreparationTime")}
          value={t("minutes", { count: stats.averagePreparationTime })}
        />
      </div>
      <RecentOrders orders={recentOrders} />
    </div>
  );
}
