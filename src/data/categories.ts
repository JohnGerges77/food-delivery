import type { Category } from "@/types";

export const categories: Category[] = [
  {
    id: "cat-pizza",
    name: "Pizza",
    slug: "pizza",
    description: "Stone-baked pies with rich sauces and fresh toppings.",
    image: "/images/categories/pizza.jpg",
  },
  {
    id: "cat-burgers",
    name: "Burgers",
    slug: "burgers",
    description: "Juicy handheld favorites with crisp sides.",
    image: "/images/categories/burgers.jpg",
  },
  {
    id: "cat-salads",
    name: "Salads",
    slug: "salads",
    description: "Fresh bowls with seasonal produce and house dressings.",
    image: "/images/categories/salads.jpg",
  },
  {
    id: "cat-drinks",
    name: "Drinks",
    slug: "drinks",
    description: "Cold beverages, juices, and signature refreshers.",
    image: "/images/categories/drinks.jpg",
  },
];
