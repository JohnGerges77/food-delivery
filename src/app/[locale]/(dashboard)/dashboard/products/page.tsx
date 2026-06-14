import { PageHeader } from "@/components/common/PageHeader";
import { ProductsTable } from "@/components/features/products/ProductsTable";
import type { Locale } from "@/i18n/routing";
import { getProducts } from "@/services/product-service";
import { getTranslations } from "next-intl/server";

export default async function ProductsManagementPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("pages.products");
  const products = getProducts(locale);

  return (
    <section className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <ProductsTable products={products} />
    </section>
  );
}
