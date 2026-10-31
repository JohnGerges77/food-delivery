import { categories } from "@/data/categories";
import { localizeCategory } from "@/data/localized";
import type { Locale } from "@/i18n/routing";

export function getCategories(locale?: Locale) {
  return categories.map((category) => localizeCategory(category, locale));
}

export function getCategoryById(id: string, locale?: Locale) {
  const category = categories.find((item) => item.id === id);
  return category ? localizeCategory(category, locale) : undefined;
}

export function getCategoryBySlug(slug: string, locale?: Locale) {
  const category = categories.find((item) => item.slug === slug);
  return category ? localizeCategory(category, locale) : undefined;
}
