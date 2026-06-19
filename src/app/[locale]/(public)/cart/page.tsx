import { CartOrderingPage } from "@/components/features/cart/CartOrderingPage";
import Footer from "@/components/layout/Footer.jsx";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import type { Locale } from "@/i18n/routing";
import { getRestaurantInfo } from "@/services/restaurant-service";

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const restaurant = getRestaurantInfo(locale);

  return (
    <>
      <PublicNavbar />
      <CartOrderingPage deliveryFee={restaurant.deliveryFee} />
      <Footer />
    </>
  );
}
