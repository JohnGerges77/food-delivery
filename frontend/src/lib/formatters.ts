import { CURRENCY } from "@/lib/constants";
import type { Locale } from "@/i18n/routing";

function getIntlLocale(locale?: string) {
  return locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";
}

export function formatCurrency(value: number, locale?: Locale | string) {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "currency",
    currency: CURRENCY,
  }).format(value);
}

export function formatDateTime(value: string, locale?: Locale | string) {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
