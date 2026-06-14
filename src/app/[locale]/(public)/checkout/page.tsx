import { CheckoutForm } from "@/components/features/checkout/CheckoutForm";
import { OrderSummary } from "@/components/features/checkout/OrderSummary";
import { PageHeader } from "@/components/common/PageHeader";
import type { Locale } from "@/i18n/routing";
import { getRestaurantInfo } from "@/services/restaurant-service";
import { getTranslations } from "next-intl/server";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("pages.checkout");
  const restaurant = getRestaurantInfo(locale);

  return (
    <main className="space-y-8 p-6">
      <PageHeader
        title={t("title")}
        description={t("description", { minimumOrder: restaurant.minimumOrder })}
      />
      <CheckoutForm />
      <OrderSummary />
    </main>
  );
}
