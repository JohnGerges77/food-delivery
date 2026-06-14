"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

const bestItems = [
  {
    name: "Signature Burger",
    category: "House Favorite",
    description:
      "Double seared beef, smoked cheddar, caramelized onion, and our warm Savora glaze.",
    price: "$18",
    badge: "Best Seller",
    image: "/best1.png",
    imagePosition: "center 38%",
    featured: true,
  },
  {
    name: "Crispy Fried Rice",
    category: "Comfort Bowl",
    description: "Wok-fired rice with herbs, toasted vegetables, and a rich savory finish.",
    price: "$14",
    badge: "Chef Pick",
    image: "/best2.png",
  },
  {
    name: "Grilled Chicken",
    category: "Flame Grill",
    description: "Charred chicken breast with buttery herbs and smoky table-side aroma.",
    price: "$21",
    badge: "Signature",
    image: "/best3.png",
  },
  {
    name: "Italian Pasta",
    category: "Slow Sauce",
    description: "Silky pasta tossed with cream, parmesan, cracked pepper, and fresh greens.",
    price: "$16",
    badge: "Popular",
    image: "/best4.png",
  },

  {
    name: "Golden Rice Plate",
    category: "Plates of Plenty",
    description: "A generous aromatic rice plate finished with crispy edges and warm spices.",
    price: "$15",
    badge: "Fresh",
    image: "/best2.png",
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.08,
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

function BestItemCard({
  item,
  index,
}: {
  item: (typeof bestItems)[number];
  index: number;
}) {
  return (
    <motion.article
      className={
        item.featured
          ? "group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[color:var(--card)]/70 shadow-[0_30px_80px_rgba(0,0,0,0.32)] backdrop-blur lg:row-span-2"
          : "group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.035] shadow-[0_18px_54px_rgba(0,0,0,0.28)] backdrop-blur"
      }
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.25 }}
      variants={cardVariants}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute -right-20 top-10 size-52 rounded-full bg-[color:var(--primary)]/20 blur-3xl" />
      </div>

      <div
        className={
          item.featured
            ? "relative aspect-[4/5] overflow-hidden sm:aspect-[16/11] lg:aspect-auto lg:h-[34rem]"
            : "relative aspect-[16/11] overflow-hidden"
        }
      >
        <Image
          alt={item.name}
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          fill
          loading={item.featured ? undefined : "eager"}
          priority={item.featured}
          sizes={
            item.featured
              ? "(min-width: 1024px) 44vw, 100vw"
              : "(min-width: 1024px) 28vw, (min-width: 640px) 50vw, 100vw"
          }
          src={item.image}
          style={{ objectPosition: item.imagePosition ?? "center" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/18 to-transparent" />
        <span className="absolute left-5 top-5 rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--background)]/60 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.18em] text-[color:var(--primary-light)] uppercase backdrop-blur">
          {item.badge}
        </span>
      </div>

      <div className={item.featured ? "p-6 sm:p-7 lg:p-8" : "p-5"}>
        <div className="mb-3 flex items-center gap-3 text-[0.68rem] font-semibold tracking-[0.2em] text-[color:var(--gold)] uppercase">
          <span className="h-px w-8 bg-[color:var(--primary)]/70" />
          {item.category}
        </div>

        <div className="flex items-start justify-between gap-5">
          <h3
            className={
              item.featured
                ? "text-3xl font-semibold text-[color:var(--text)] sm:text-4xl"
                : "text-xl font-semibold text-[color:var(--text)]"
            }
          >
            {item.name}
          </h3>
          <span className="rounded-full bg-[color:var(--primary)]/10 px-3 py-1 text-sm font-bold text-[color:var(--primary-light)]">
            {item.price}
          </span>
        </div>

        <p
          className={
            item.featured
              ? "mt-4 max-w-xl text-base leading-8 text-[color:var(--text-muted)]"
              : "mt-3 text-sm leading-6 text-[color:var(--text-muted)]"
          }
        >
          {item.description}
        </p>

        <Link
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--primary-light)] transition-colors duration-300 hover:text-[color:var(--text)]"
          href={routes.menu}
        >
          View Item
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            -&gt;
          </span>
        </Link>
      </div>
    </motion.article>
  );
}

export default function BestItems() {
  return (
    <section className="relative isolate overflow-hidden bg-[color:var(--background)] px-4 py-20 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="absolute left-1/2 top-10 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.16),transparent_66%)] blur-3xl" />
      <div className="absolute bottom-0 right-[-12rem] -z-10 size-[28rem] rounded-full bg-[color:var(--primary)]/10 blur-3xl" />

      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <div className="mb-5 flex items-center justify-center gap-4 text-xs font-semibold tracking-[0.24em] text-[color:var(--primary-light)] uppercase">
            <span className="h-px w-10 bg-[color:var(--primary)]/60" />
            Chef&apos;s Favorites
            <span className="h-px w-10 bg-[color:var(--primary)]/60" />
          </div>
          <h2 className="text-4xl font-semibold text-balance text-[color:var(--text)] sm:text-5xl lg:text-6xl">
            A Collection of Comfort Foods
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">
            Plates of plenty, handmade for slow evenings, quick cravings, and every
            golden moment between.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-[1.08fr_0.92fr_0.92fr] lg:grid-rows-2">
          {bestItems.map((item, index) => (
            <BestItemCard index={index} item={item} key={`${item.name}-${index}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
