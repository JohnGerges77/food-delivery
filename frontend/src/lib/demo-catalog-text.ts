const products = {
  "cheese-burger": {
    name: "تشيز برجر",
    description: "برجر لحم مشوي مع جبنة شيدر ومخلل وصوص المطعم في خبز محمّص.",
  },
  "pizza-margherita": {
    name: "بيتزا مارغريتا",
    description: "بيتزا مخبوزة على الحجر بصلصة الطماطم والموزاريلا الطازجة والريحان.",
  },
  "french-fries": {
    name: "بطاطس مقلية",
    description: "بطاطس ذهبية مقرمشة مع رشة ملح بحري.",
  },
} as const;

const categories = { burgers: "البرجر", pizza: "البيتزا", sides: "أطباق جانبية" } as const;
const variants = { Single: "سنجل", Double: "دبل", Small: "صغير", Medium: "وسط", Large: "كبير" } as const;

export function demoCatalogText(restaurantSlug: string, locale: string) {
  if (restaurantSlug !== "savora-beta-demo" || locale !== "ar") return null;
  return {
    product: (slug: string) => Object.hasOwn(products, slug) ? products[slug as keyof typeof products] : undefined,
    category: (slug: string) => Object.hasOwn(categories, slug) ? categories[slug as keyof typeof categories] : undefined,
    variant: (name: string) => Object.hasOwn(variants, name) ? variants[name as keyof typeof variants] : name,
  };
}
