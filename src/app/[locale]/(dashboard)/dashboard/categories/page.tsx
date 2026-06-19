import { DashboardCategoriesPage } from "@/components/features/dashboard/DashboardCategoriesPage";
import type { Locale } from "@/i18n/routing";
import { getCategories } from "@/services/category-service";
import { getProducts } from "@/services/product-service";

export default async function CategoriesManagementPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const categories = getCategories(locale);
  const products = getProducts(locale);

  return <DashboardCategoriesPage categories={categories} products={products} />;
}
