import { MenuGrid } from "@/components/features/menu/MenuGrid";
import { PageHeader } from "@/components/common/PageHeader";
import type { Locale } from "@/i18n/routing";
import { getCategories } from "@/services/category-service";
import { getProducts } from "@/services/product-service";
import { getTranslations } from "next-intl/server";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("pages.menu");
  const products = getProducts(locale);
  const categories = getCategories(locale);

  return (
    <main className="space-y-8 p-6">
      <PageHeader
        title={t("title")}
        description={t("description", {
          productCount: products.length,
          categoryCount: categories.length,
        })}
      />
      <MenuGrid products={products} />
    </main>
  );
}
