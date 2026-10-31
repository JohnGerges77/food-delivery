"use client";

import { createContext, useContext } from "react";
import type { PublicCategory, PublicRestaurant } from "@/services/public-menu";

type StorefrontContextValue = {
  restaurant: PublicRestaurant;
  categories: PublicCategory[];
  basePath: string;
  href: (path?: string) => string;
};

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function StorefrontProvider({ restaurant, categories, basePath, children }: {
  restaurant: PublicRestaurant; categories: PublicCategory[]; basePath: string;
  children: React.ReactNode;
}) {
  const href = (path = "/") => `${basePath}${path}`;
  return <StorefrontContext.Provider value={{ restaurant, categories, basePath, href }}>{children}</StorefrontContext.Provider>;
}

export function useStorefront() {
  const context = useContext(StorefrontContext);
  if (!context) throw new Error("Storefront context is missing");
  return context;
}
