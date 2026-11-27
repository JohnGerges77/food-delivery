"use client";

import dynamic from "next/dynamic";
import { usePathname } from "@/i18n/navigation";
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ComponentProps, type ReactNode } from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import Footer from "@/components/layout/Footer";
import { useCartStore } from "@/store/cart-store";
import { resolveStorefrontTheme } from "@/lib/storefront-theme";
import { storefrontAccentStyle } from "@/lib/storefront-accent";
import type { PublicCategory, PublicRestaurant } from "@/services/public-menu";
import { StorefrontProvider } from "./StorefrontContext";

const AquaFrame = dynamic(() => import("./aqua/AquaStorefront").then((m) => m.AquaFrame));
const CafeFrame = dynamic(() => import("./cafe/CafeStorefront").then((m) => m.CafeFrame));
const LuxuryFrame = dynamic(() => import("./luxury/LuxuryStorefront").then((m) => m.LuxuryFrame));
const UpdateRestaurant = createContext<((restaurant: PublicRestaurant) => void) | null>(null);
const noCategories: PublicCategory[] = [];

export type ThemeFrameProps = ComponentProps<"div"> & { children: ReactNode };

function ClassicFrame({ children, ...scope }: ThemeFrameProps) {
  return <div {...scope}><PublicNavbar />{children}<Footer /></div>;
}

const frames = {
  "savora-classic": ClassicFrame, "savora-aqua": AquaFrame,
  "savora-cafe": CafeFrame, "savora-luxury": LuxuryFrame,
};

export function StorefrontFrame({ initialRestaurant, basePath, children }: {
  initialRestaurant: PublicRestaurant; basePath: string; children: ReactNode;
}) {
  const [updatedRestaurant, setUpdatedRestaurant] = useState<PublicRestaurant | null>(null);
  const restaurant = updatedRestaurant ?? initialRestaurant;
  const setTenant = useCartStore((state) => state.setTenant);
  useEffect(() => { setTenant(restaurant.slug); }, [restaurant.slug, setTenant]);
  const pathname = usePathname();
  const path = pathname.slice(basePath.length).split("/").filter(Boolean);
  const page = path.length > 1 && path[0] === "menu" ? "product" : path[0] ?? "home";
  const theme = resolveStorefrontTheme(restaurant);
  const Frame = frames[theme];
  const accent = storefrontAccentStyle(theme, restaurant.branding.primaryColor);
  return <UpdateRestaurant.Provider value={setUpdatedRestaurant}>
    <StorefrontProvider restaurant={restaurant} categories={noCategories} basePath={basePath}>
      <Frame data-storefront-theme={theme} data-storefront-page={page}
        data-custom-accent={accent ? "" : undefined} style={accent}
        className="min-h-screen bg-[color:var(--sf-background)] text-[color:var(--sf-text)]">
        {children}
      </Frame>
    </StorefrontProvider>
  </UpdateRestaurant.Provider>;
}

export function StorefrontPageScope({ restaurant, categories = noCategories, basePath, children }: {
  restaurant: PublicRestaurant; categories?: PublicCategory[]; basePath: string; children: ReactNode;
}) {
  const updateRestaurant = useContext(UpdateRestaurant);
  useLayoutEffect(() => { updateRestaurant?.(restaurant); }, [restaurant, updateRestaurant]);
  return <StorefrontProvider restaurant={restaurant} categories={categories} basePath={basePath}>{children}</StorefrontProvider>;
}
