import { DashboardProductsPage } from "@/components/features/dashboard/DashboardProductsPage";
import type { Locale } from "@/i18n/routing";
import { getCategories } from "@/services/category-service";
import { getProducts } from "@/services/product-service";

export default async function ProductsManagementPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const products = getProducts(locale);
  const categories = getCategories(locale);

  return <DashboardProductsPage categories={categories} products={products} />;
}
