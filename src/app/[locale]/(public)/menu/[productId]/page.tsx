import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { ProductDetails } from "@/components/features/menu/ProductDetails";
import Footer from "@/components/layout/Footer.jsx";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import type { Locale } from "@/i18n/routing";
import { getProductById } from "@/services/product-service";
import { getTranslations } from "next-intl/server";

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ locale: Locale; productId: string }>;
}) {
  const { locale, productId } = await params;
  const t = await getTranslations("pages.productDetails");
  const product = getProductById(productId, locale);

  if (!product) {
    notFound();
  }

  return <>
    <PublicNavbar />
    <main className="space-y-8 bg-[color:var(--background)] p-6 text-[color:var(--text)]">
      <PageHeader title={t("title")} description={t("description")} />
      <ProductDetails product={product} />
    </main>
    <Footer />
  </>;
}
