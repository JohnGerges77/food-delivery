import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { ProductDetails } from "@/components/features/menu/ProductDetails";
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

  return (
    <main className="space-y-8 p-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <ProductDetails product={product} />
    </main>
  );
}
