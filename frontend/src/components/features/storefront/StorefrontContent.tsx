"use client";

import dynamic from "next/dynamic";
import { resolveStorefrontTheme } from "@/lib/storefront-theme";
import type { PublicPage, PublicProduct } from "@/services/public-menu";
import type { CheckoutAvailability } from "@/services/guest-checkout-service";
import { useStorefront } from "./StorefrontContext";

const Cart = dynamic(() => import("../cart/CartOrderingPage").then((m) => m.CartOrderingPage));
const Checkout = dynamic(() => import("../checkout/CheckoutOrderingPage").then((m) => m.CheckoutOrderingPage));
const AboutImage = dynamic(() => import("./AboutImage").then((m) => m.AboutImage));

const themes = {
  "savora-classic": {
    Home: dynamic(() => import("./ClassicStorefront").then((m) => m.ClassicHomeContent)),
    Menu: dynamic(() => import("../menu/MenuOrderingPage").then((m) => m.MenuOrderingPage)),
    Product: dynamic(() => import("./ClassicStorefront").then((m) => m.ClassicProduct)),
    About: dynamic(() => import("./ClassicStorefront").then((m) => m.ClassicAbout)),
  },
  "savora-aqua": {
    Home: dynamic(() => import("./aqua/AquaStorefront").then((m) => m.AquaHome)),
    Menu: dynamic(() => import("./aqua/AquaStorefront").then((m) => m.AquaMenu)),
    Product: dynamic(() => import("./aqua/AquaStorefront").then((m) => m.AquaProduct)),
    About: dynamic(() => import("./aqua/AquaStorefront").then((m) => m.AquaAbout)),
  },
  "savora-cafe": {
    Home: dynamic(() => import("./cafe/CafeStorefront").then((m) => m.CafeHome)),
    Menu: dynamic(() => import("./cafe/CafeStorefront").then((m) => m.CafeMenu)),
    Product: dynamic(() => import("./cafe/CafeStorefront").then((m) => m.CafeProduct)),
    About: dynamic(() => import("./cafe/CafeStorefront").then((m) => m.CafeAbout)),
  },
  "savora-luxury": {
    Home: dynamic(() => import("./luxury/LuxuryStorefront").then((m) => m.LuxuryHome)),
    Menu: dynamic(() => import("./luxury/LuxuryStorefront").then((m) => m.LuxuryMenu)),
    Product: dynamic(() => import("./luxury/LuxuryStorefront").then((m) => m.LuxuryProduct)),
    About: dynamic(() => import("./luxury/LuxuryStorefront").then((m) => m.LuxuryAbout)),
  },
};

type Props =
  | { page: "home"; initialProducts: PublicProduct[]; offers: PublicProduct[] }
  | { page: "menu"; initialProducts: PublicProduct[]; initialPagination: PublicPage }
  | { page: "product"; product: PublicProduct }
  | { page: "about" }
  | { page: "cart" | "checkout"; checkoutAvailability: CheckoutAvailability; beta: boolean };

export function StorefrontContent(props: Props) {
  const { restaurant } = useStorefront();
  const themeId = resolveStorefrontTheme(restaurant);
  const theme = themes[themeId];
  switch (props.page) {
    case "home": return <theme.Home restaurant={restaurant} initialProducts={props.initialProducts} offers={props.offers} />;
    case "menu": return <theme.Menu initialProducts={props.initialProducts} initialPagination={props.initialPagination} />;
    case "product": return <theme.Product product={props.product} />;
    case "about": return <><theme.About />{themeId !== "savora-classic" && <AboutImage src={restaurant.aboutImageUrl} name={restaurant.name} />}</>;
    case "cart":
    case "checkout": {
      const ordering = {
        slug: restaurant.slug, currency: restaurant.currency, deliveryFee: restaurant.deliverySettings.deliveryFee,
        checkoutAvailability: props.checkoutAvailability,
      };
      return props.page === "cart" ? <Cart {...ordering} /> : <Checkout {...ordering} beta={props.beta} />;
    }
  }
}
