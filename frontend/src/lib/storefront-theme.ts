import type { PublicRestaurant } from "@/services/public-menu";

// Only shipped themes belong here. Values on old records and unsupported values render Classic.
export const CLASSIC_STOREFRONT_THEME = "savora-classic" as const;
export const AQUA_STOREFRONT_THEME = "savora-aqua" as const;
export const CAFE_STOREFRONT_THEME = "savora-cafe" as const;
export const LUXURY_STOREFRONT_THEME = "savora-luxury" as const;
export type StorefrontThemeId = typeof CLASSIC_STOREFRONT_THEME | typeof AQUA_STOREFRONT_THEME | typeof CAFE_STOREFRONT_THEME | typeof LUXURY_STOREFRONT_THEME;

export function resolveStorefrontTheme(restaurant: Pick<PublicRestaurant, "storefrontTheme">): StorefrontThemeId {
  return restaurant.storefrontTheme === CLASSIC_STOREFRONT_THEME || restaurant.storefrontTheme === AQUA_STOREFRONT_THEME || restaurant.storefrontTheme === CAFE_STOREFRONT_THEME || restaurant.storefrontTheme === LUXURY_STOREFRONT_THEME
    ? restaurant.storefrontTheme
    : CLASSIC_STOREFRONT_THEME;
}
