import BestItems from "@/components/features/landing/Bestitems";
import { FeaturedProducts } from "@/components/features/landing/FeaturedProducts";
import { HeroSection } from "@/components/features/landing/HeroSection";
import WhyChoose from "@/components/features/landing/WhyChoose";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import type { Locale } from "@/i18n/routing";
import { getRestaurantInfo } from "@/services/restaurant-service";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const restaurant = getRestaurantInfo(locale);

  return (
    <>
      <PublicNavbar />
      <main className="bg-[color:var(--background)]">
        <HeroSection restaurant={restaurant} />
        <BestItems />
        <FeaturedProducts />
        <WhyChoose />
      </main>
    </>
  );
}
