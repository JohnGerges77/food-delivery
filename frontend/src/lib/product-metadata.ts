type MetadataSource = { calories?: number | null; preparationTime?: number | null };

export function productMetadata(product: MetadataSource, locale: string) {
  const ar = locale === "ar";
  const number = (value: number) => String(value);
  const entries: { label: string; value: string }[] = [];
  if (typeof product.calories === "number" && Number.isFinite(product.calories)) {
    entries.push({ label: ar ? "السعرات الحرارية" : "Calories", value: number(product.calories) });
  }
  if (typeof product.preparationTime === "number" && Number.isFinite(product.preparationTime)) {
    entries.push({ label: ar ? "وقت التحضير" : "Preparation Time", value: `${number(product.preparationTime)} ${ar ? "دقيقة" : "min"}` });
  }
  return entries;
}
