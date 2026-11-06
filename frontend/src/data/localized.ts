import type { Category, Order, Product, Restaurant, TopProduct } from "@/types";
import type { Locale } from "@/i18n/routing";

const productTranslations: Record<string, { name: string; description: string }> = {
  "prod-margherita": {
    name: "بيتزا مارجريتا",
    description: "طماطم كلاسيكية وموزاريلا وريحان وزيت زيتون.",
  },
  "prod-pepperoni": {
    name: "بيتزا بيبروني",
    description: "موزاريلا وبيبروني وأوريغانو وصلصة طماطم.",
  },
  "prod-smash-burger": {
    name: "برجر سماش مزدوج",
    description: "قطعتا لحم محمرتان وجبن شيدر ومخلل وصلصة المطعم.",
  },
  "prod-caesar": {
    name: "سلطة سيزر بالدجاج",
    description: "خس روماني ودجاج مشوي وبارميزان وقطع خبز وصلصة سيزر.",
  },
  "prod-lemonade": {
    name: "ليمون بالنعناع",
    description: "ليمون طازج ونعناع ومياه فوارة وشراب قصب خفيف.",
  },
};

const categoryTranslations: Record<string, { name: string; description: string }> = {
  "cat-pizza": {
    name: "بيتزا",
    description: "بيتزا مخبوزة على الحجر بصلصات غنية وإضافات طازجة.",
  },
  "cat-burgers": {
    name: "برجر",
    description: "وجبات برجر شهية مع جوانب مقرمشة.",
  },
  "cat-salads": {
    name: "سلطات",
    description: "أطباق طازجة بخضروات موسمية وصلصات خاصة.",
  },
  "cat-drinks": {
    name: "مشروبات",
    description: "مشروبات باردة وعصائر ومشروبات منعشة مميزة.",
  },
};

const topProductTranslations: Record<string, string> = {
  "prod-smash-burger": "برجر سماش مزدوج",
  "prod-margherita": "بيتزا مارجريتا",
  "prod-pepperoni": "بيتزا بيبروني",
};

function shouldLocalize(locale?: Locale) {
  return locale === "ar";
}

export function localizeProduct(product: Product, locale?: Locale): Product {
  if (!shouldLocalize(locale)) {
    return product;
  }

  const translation = productTranslations[product.id];

  return translation ? { ...product, ...translation } : product;
}

export function localizeCategory(category: Category, locale?: Locale): Category {
  if (!shouldLocalize(locale)) {
    return category;
  }

  const translation = categoryTranslations[category.id];

  return translation ? { ...category, ...translation } : category;
}

export function localizeRestaurant(restaurant: Restaurant, locale?: Locale): Restaurant {
  if (!shouldLocalize(locale)) {
    return restaurant;
  }

  return {
    ...restaurant,
    name: "بيسترو سنترال",
    description: "مطعم حي يركز على التوصيل السريع والمأكولات الطازجة المريحة.",
    address: "22 شارع الجزيرة، القاهرة",
    openingHours: "10:00 صباحًا - 12:00 منتصف الليل",
  };
}

export function localizeOrder(order: Order, locale?: Locale): Order {
  if (!shouldLocalize(locale)) {
    return order;
  }

  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      name: productTranslations[item.productId]?.name ?? item.name,
    })),
  };
}

export function localizeTopProduct(product: TopProduct, locale?: Locale): TopProduct {
  if (!shouldLocalize(locale)) {
    return product;
  }

  return {
    ...product,
    name: topProductTranslations[product.productId] ?? product.name,
  };
}
