import { CheckoutOrderingPage } from "@/components/features/checkout/CheckoutOrderingPage";
import Footer from "@/components/layout/Footer.jsx";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import type { Locale } from "@/i18n/routing";
import { getRestaurantInfo } from "@/services/restaurant-service";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const restaurant = getRestaurantInfo(locale);

  return (
    <>
      <PublicNavbar />
      <CheckoutOrderingPage deliveryFee={restaurant.deliveryFee} />
      <Footer />
    </>
  );
}
