import { PageHeader } from "@/components/common/PageHeader";
import { CategoriesTable } from "@/components/features/categories/CategoriesTable";
import type { Locale } from "@/i18n/routing";
import { getCategories } from "@/services/category-service";
import { getTranslations } from "next-intl/server";

export default async function CategoriesManagementPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("pages.categories");
  const categories = getCategories(locale);

  return (
    <section className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <CategoriesTable categories={categories} />
    </section>
  );
}
