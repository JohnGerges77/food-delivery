import { PageHeader } from "@/components/common/PageHeader";
import { RestaurantInfoForm } from "@/components/features/settings/RestaurantInfoForm";
import type { Locale } from "@/i18n/routing";
import { getRestaurantInfo } from "@/services/restaurant-service";
import { getTranslations } from "next-intl/server";

export default async function RestaurantSettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("pages.settings");
  const restaurant = getRestaurantInfo(locale);

  return (
    <section className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <RestaurantInfoForm restaurant={restaurant} />
    </section>
  );
}
