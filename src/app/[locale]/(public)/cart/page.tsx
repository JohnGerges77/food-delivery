import { CartEmptyState } from "@/components/features/cart/CartEmptyState";
import { CartSummary } from "@/components/features/cart/CartSummary";
import { PageHeader } from "@/components/common/PageHeader";
import type { Locale } from "@/i18n/routing";
import { getRestaurantInfo } from "@/services/restaurant-service";
import { getTranslations } from "next-intl/server";

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("pages.cart");
  const restaurant = getRestaurantInfo(locale);

  return (
    <main className="space-y-8 p-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <CartSummary deliveryFee={restaurant.deliveryFee} subtotal={0} total={restaurant.deliveryFee} />
      <CartEmptyState />
    </main>
  );
}
