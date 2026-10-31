import { products } from "@/data/products";
import { localizeProduct } from "@/data/localized";
import type { Locale } from "@/i18n/routing";

export function getProducts(locale?: Locale) {
  return products.map((product) => localizeProduct(product, locale));
}

export function getFeaturedProducts(locale?: Locale) {
  return getProducts(locale).filter((product) => product.isFeatured);
}

export function getProductById(id: string, locale?: Locale) {
  const product = products.find((item) => item.id === id);
  return product ? localizeProduct(product, locale) : undefined;
}

export function getProductBySlug(slug: string, locale?: Locale) {
  const product = products.find((item) => item.slug === slug);
  return product ? localizeProduct(product, locale) : undefined;
}

export function getProductsByCategory(categoryId: string, locale?: Locale) {
  return getProducts(locale).filter((product) => product.categoryId === categoryId);
}

export function searchProducts(query: string, locale?: Locale) {
  const normalizedQuery = query.trim().toLowerCase();
  const localizedProducts = getProducts(locale);

  if (!normalizedQuery) {
    return localizedProducts;
  }

  return localizedProducts.filter((product) =>
    [product.name, product.description, product.slug].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    ),
  );
}
