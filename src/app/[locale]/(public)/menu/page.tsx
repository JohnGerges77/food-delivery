import { MenuOrderingPage } from "@/components/features/menu/MenuOrderingPage";
import Footer from "@/components/layout/Footer.jsx";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import type { Locale } from "@/i18n/routing";
import { getProducts } from "@/services/product-service";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const products = getProducts(locale);

  return (
    <>
      <PublicNavbar />
      <MenuOrderingPage products={products} />
      <Footer />
    </>
  );
}
