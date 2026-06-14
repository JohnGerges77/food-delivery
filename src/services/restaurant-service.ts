import { restaurant } from "@/data/restaurant";
import { localizeRestaurant } from "@/data/localized";
import type { Locale } from "@/i18n/routing";

export function getRestaurantInfo(locale?: Locale) {
  return localizeRestaurant(restaurant, locale);
}
