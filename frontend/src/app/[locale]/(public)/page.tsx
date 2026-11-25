import { StorefrontView, restaurantMetadata } from "@/components/features/storefront/StorefrontView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return restaurantMetadata((await params).locale);
}
export default function Page() { return <StorefrontView page="home" />; }
