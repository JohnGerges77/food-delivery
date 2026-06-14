"use client";

/* eslint-disable @next/next/no-img-element */
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

const menuEase = [0.16, 1, 0.3, 1] as const;

const menuCategories = ["Appetizers", "Main Dishes", "Burgers", "Desserts"];

const menuItems = [
  {
    id: "greek-salad",
    name: "Greek Salad",
    description: "Crisp greens, feta, olives, cucumber, and lemon herb dressing.",
    price: "$11",
    category: "Appetizers",
    image:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "crispy-shrimp",
    name: "Crispy Shrimp",
    description: "Golden shrimp with chili aioli and a bright citrus finish.",
    price: "$15",
    category: "Appetizers",
    image:
      "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "mozzarella-sticks",
    name: "Mozzarella Sticks",
    description: "Hand-cut mozzarella, crisp crumbs, and slow tomato sauce.",
    price: "$10",
    category: "Appetizers",
    image:
      "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "grilled-chicken",
    name: "Grilled Chicken",
    description: "Flame-grilled chicken with herbed butter and roasted vegetables.",
    price: "$22",
    category: "Main Dishes",
    image:
      "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "creamy-pasta",
    name: "Creamy Pasta",
    description: "Silky parmesan cream, cracked pepper, and fresh garden herbs.",
    price: "$18",
    category: "Main Dishes",
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "salmon-plate",
    name: "Salmon Plate",
    description: "Pan-seared salmon with lemon glaze and warm seasonal grains.",
    price: "$27",
    category: "Main Dishes",
    image:
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "signature-burger",
    name: "Signature Burger",
    description: "Seared beef, smoked cheddar, caramelized onion, and Savora sauce.",
    price: "$18",
    category: "Burgers",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "double-cheese-burger",
    name: "Double Cheese Burger",
    description: "Two patties, melted cheese, pickles, and toasted brioche.",
    price: "$21",
    category: "Burgers",
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "spicy-bbq-burger",
    name: "Spicy BBQ Burger",
    description: "Pepper jack, smoked barbecue glaze, jalapeno, and crisp onions.",
    price: "$20",
    category: "Burgers",
    image:
      "https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "chocolate-lava-cake",
    name: "Chocolate Lava Cake",
    description: "Warm chocolate center, cocoa crumble, and vanilla cream.",
    price: "$12",
    category: "Desserts",
    image:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "classic-cheesecake",
    name: "Classic Cheesecake",
    description: "Creamy cheesecake with berry glaze and butter biscuit crust.",
    price: "$11",
    category: "Desserts",
    image:
      "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=320&q=80",
  },
  {
    id: "honey-pancakes",
    name: "Honey Pancakes",
    description: "Soft pancakes with honey butter, toasted nuts, and cream.",
    price: "$13",
    category: "Desserts",
    image:
      "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=320&q=80",
  },
];

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.06,
      duration: 0.45,
      ease: menuEase,
    },
  }),
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

export function FeaturedProducts() {
  const [activeCategory, setActiveCategory] = useState(menuCategories[0]);
  const filteredItems = menuItems.filter((item) => item.category === activeCategory);

  return (
    <section className="relative isolate overflow-hidden bg-[color:var(--background)] px-4 py-20 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="absolute left-[-10rem] top-20 -z-10 size-[26rem] rounded-full bg-[color:var(--primary)]/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 -z-10 size-[34rem] translate-x-1/3 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.16),transparent_68%)] blur-3xl" />

      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <div className="mb-5 flex items-center justify-center gap-4 text-xs font-semibold tracking-[0.24em] text-[color:var(--primary-light)] uppercase">
            <span className="h-px w-10 bg-[color:var(--primary)]/60" />
            Our Menu
            <span className="h-px w-10 bg-[color:var(--primary)]/60" />
          </div>
          <h2 className="text-4xl font-semibold text-balance text-[color:var(--text)] sm:text-5xl lg:text-6xl">
            Taste the Favorites
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">
            A curated preview of our most-loved dishes, crafted with fresh
            ingredients and served with Savora&apos;s signature flavor.
          </p>
        </motion.div>

        <motion.div
          className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2 rounded-[2rem] border border-white/10 bg-white/[0.025] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.12, duration: 0.55, ease: "easeOut" }}
        >
          {menuCategories.map((category) => {
            const isActive = activeCategory === category;

            return (
              <button
                className="relative overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-300"
                key={category}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                {isActive ? (
                  <motion.span
                    className="absolute inset-0 rounded-full border border-[color:var(--primary)] bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] shadow-[0_14px_42px_rgba(255,122,0,0.34)]"
                    layoutId="active-menu-category"
                    transition={{ duration: 0.42, ease: menuEase }}
                  />
                ) : (
                  <span className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.03] transition-all duration-300 hover:border-[color:var(--primary)]/35 hover:bg-white/[0.07]" />
                )}
                <span
                  className={
                    isActive
                      ? "relative z-10 text-[color:var(--background)]"
                      : "relative z-10 text-[color:var(--text-muted)] transition-colors duration-300 hover:text-[color:var(--text)]"
                  }
                >
                  {category}
                </span>
              </button>
            );
          })}
        </motion.div>

        <div className="relative mt-12 rounded-[1.75rem] border border-white/10 bg-[color:var(--card)]/40 p-3 shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur sm:p-5 lg:p-8">
          <div className="pointer-events-none absolute inset-y-8 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-[color:var(--primary)]/25 to-transparent lg:block" />
          <AnimatePresence mode="wait">
            <motion.div
              className="grid gap-4 lg:grid-cols-2 lg:gap-x-10"
              key={activeCategory}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {filteredItems.map((item, index) => (
                <motion.article
                  className="group relative grid grid-cols-[4.75rem_1fr_auto] items-center gap-4 overflow-hidden rounded-2xl border border-white/0 bg-white/[0.02] p-3 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--primary)]/35 hover:bg-white/[0.07] hover:shadow-[0_22px_54px_rgba(255,122,0,0.14)] sm:grid-cols-[5.5rem_1fr_auto] sm:p-4"
                  custom={index}
                  key={item.id}
                  variants={itemVariants}
                >
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-[color:var(--primary)]/0 to-transparent transition-colors duration-300 group-hover:via-[color:var(--primary)]/80" />
                  <div className="pointer-events-none absolute -right-12 top-1/2 size-28 -translate-y-1/2 rounded-full bg-[color:var(--primary)]/0 blur-2xl transition-colors duration-500 group-hover:bg-[color:var(--primary)]/18" />

                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--background)] transition-all duration-300 group-hover:border-[color:var(--primary)]/35 group-hover:shadow-[0_0_28px_rgba(255,122,0,0.14)]">
                    <img
                      alt={item.name}
                      className="size-[4.75rem] object-cover transition-transform duration-500 group-hover:scale-110 sm:size-[5.5rem]"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      src={item.image}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[0.65rem] font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                      {item.category}
                    </div>
                    <h3 className="mt-1 truncate text-base font-semibold text-[color:var(--text)] transition-colors duration-300 group-hover:text-[color:var(--primary-light)] sm:text-lg">
                      {item.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--text-muted)]">
                      {item.description}
                    </p>
                  </div>

                  <div className="self-start rounded-full border border-[color:var(--primary)]/10 bg-[color:var(--primary)]/10 px-3 py-1 text-sm font-bold text-[color:var(--primary-light)] transition-all duration-300 group-hover:border-[color:var(--primary)]/35 group-hover:bg-[color:var(--primary)]/15 group-hover:shadow-[0_0_22px_rgba(255,122,0,0.16)]">
                    {item.price}
                  </div>
                </motion.article>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          className="mt-10 flex justify-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <Link
            className="rounded-full bg-[color:var(--primary)] px-8 py-3 text-sm font-bold text-[color:var(--background)] shadow-[0_18px_48px_rgba(255,122,0,0.28)] transition-all duration-300 hover:-translate-y-1 hover:bg-[color:var(--primary-light)]"
            href={routes.menu}
          >
            View Full Menu
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
