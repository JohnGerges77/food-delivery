import { DashboardSettingsPage } from "@/components/features/dashboard/DashboardSettingsPage";
import type { Locale } from "@/i18n/routing";
import { getRestaurantInfo } from "@/services/restaurant-service";

export default async function RestaurantSettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const restaurant = getRestaurantInfo(locale);

  return <DashboardSettingsPage restaurant={restaurant} />;
}
