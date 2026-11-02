"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { sectionEase } from "@/lib/animations";
import { routes } from "@/lib/routes";
import type { PublicRestaurant } from "@/services/public-menu";
import { safePublicImage } from "@/lib/public-menu-presentation";
import { PublicProductImage } from "@/components/features/storefront/PublicProductImage";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";

export function HeroSection({ restaurant }: { restaurant: PublicRestaurant }) {
  const { href } = useStorefront();
  const isArabic = useLocale() === "ar";
  const reduceMotion = useReducedMotion();
  const stats = [
    { value: restaurant.currency, label: isArabic ? "العملة" : "Currency" },
    { value: restaurant.openingHours || "—", label: isArabic ? "ساعات العمل" : "Opening Hours" },
    { value: restaurant.deliverySettings.deliveryAvailable ? (isArabic ? "متاح" : "Available") : (isArabic ? "غير متاح" : "Unavailable"), label: isArabic ? "التوصيل" : "Delivery" },
  ];

  const particles = [
    "left-[8%] top-[20%] size-2 opacity-45",
    "left-[18%] bottom-[22%] size-1.5 opacity-35",
    "right-[12%] top-[26%] size-1.5 opacity-40",
    "right-[18%] bottom-[18%] size-2 opacity-30",
  ];

  const flavorChips = [
    { label: isArabic ? "المطعم" : "Restaurant", className: "left-4 top-[18%]" },
    { label: isArabic ? "القائمة" : "Menu", className: "right-0 top-[28%]" },
    { label: isArabic ? "تواصل معنا" : "Contact", className: "bottom-[18%] left-[12%]" },
  ];

  return (
    <section className="relative isolate flex min-h-[calc(100svh-73px)] overflow-hidden bg-[color:var(--background)] px-4 py-8 text-[color:var(--text)] sm:px-6 sm:py-10 lg:px-8">
      <div className="absolute inset-0 -z-20 bg-[image:var(--hero-background)]" />
      <div className="absolute right-[-12%] top-[8%] -z-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.24),transparent_68%)] blur-3xl" />
      <div className="absolute inset-y-0 left-0 -z-10 w-2/3 bg-[linear-gradient(110deg,transparent,rgba(255,157,51,0.12),transparent)] blur-2xl" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[color:var(--background)] to-transparent" />

      {particles.map((className) => (
        <span
          className={`absolute rounded-full bg-[color:var(--primary-light)] shadow-[0_0_22px_rgba(255,157,51,0.75)] ${className}`}
          key={className}
        />
      ))}

      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 sm:gap-12 lg:grid-cols-[0.92fr_1.08fr]">
        <motion.div
          className="order-2 max-w-3xl text-center lg:order-1 lg:pt-0 lg:text-left"
          initial={{ opacity: 0, x: -34 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.75, ease: sectionEase }}
        >
          <motion.div
            className="group relative mx-auto mb-5 inline-flex overflow-hidden rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-[color:var(--primary-light)] uppercase shadow-[0_0_28px_rgba(255,122,0,0.18)] sm:mb-6 sm:tracking-[0.22em] lg:mx-0"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8, ease: "easeOut" }}
          >
            <span className="mt-1 size-1.5 rounded-full bg-[color:var(--primary-light)] shadow-[0_0_14px_rgba(255,157,51,0.95)]" />
            {isArabic ? "أهلاً بكم في" : "Welcome to"}
            <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/18 to-transparent transition-transform duration-700 group-hover:translate-x-[320%]" />
          </motion.div>

          <motion.h1
            className="text-4xl leading-[0.98] font-semibold text-balance text-[color:var(--text)] sm:text-6xl "
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.8, ease: "easeOut" }}
          >
            {restaurant.branding.brandName || restaurant.name}
            <span className="block text-[color:var(--primary-light)]">
              {isArabic ? "اكتشف القائمة" : "Explore the Menu"}
            </span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-lg lg:mx-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.65 }}
          >
            {restaurant.description || (isArabic ? "استكشف قائمة المطعم وأطباقه المتاحة." : "Explore this restaurant's available menu.")}
          </motion.p>

          <motion.div
            className="mt-6 flex flex-col justify-center gap-3 sm:mt-7 sm:flex-row sm:gap-4 lg:justify-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.65 }}
          >
            <div>
              <Link
                className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-8 text-sm font-bold tracking-wide text-[color:var(--background)] shadow-[0_18px_48px_rgba(255,122,0,0.36)] transition-all duration-300 hover:-translate-y-1 hover:bg-[color:var(--primary-light)] sm:w-auto"
                href={href(routes.menu)}
              >
                {isArabic ? "استعرض القائمة" : "Explore Menu"}
              </Link>
            </div>
            <div>
              <Link
                className="inline-flex min-h-13 w-full items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--glass)] px-8 text-sm font-bold tracking-wide text-[color:var(--text)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--primary-light)]/50 hover:bg-[color:var(--glass-strong)] sm:w-auto"
                href={href(routes.about)}
              >
              {isArabic ? "من نحن" : "About Us"}
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="mt-6 grid grid-cols-3 overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--glass)] backdrop-blur sm:mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.65 }}
          >
            {stats.map((stat) => (
              <div
                className="border-r border-[color:var(--border)] px-2 py-3 text-center last:border-r-0 sm:px-5 sm:py-4 lg:text-left"
                key={stat.label}
              >
                <div className="line-clamp-2 text-base font-semibold text-[color:var(--text)] sm:text-xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-[0.62rem] font-medium tracking-[0.14em] text-[color:var(--text-muted)] uppercase sm:text-xs sm:tracking-[0.18em]">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="order-1 relative mx-auto flex min-h-[240px] w-full max-w-[430px] items-center justify-center sm:min-h-[360px] sm:max-w-[680px] lg:order-2 lg:min-h-[560px]"
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.8, ease: sectionEase }}
        >
          <div className="absolute inset-8 rounded-full bg-[radial-gradient(circle,rgba(255,157,51,0.52),rgba(255,122,0,0.22)_38%,transparent_68%)] blur-2xl" />
          <div className="absolute h-[62%] w-[62%] rounded-full border border-dashed border-[color:var(--gold)]/25 shadow-[0_0_90px_rgba(255,122,0,0.2)]" />
          {flavorChips.map((chip) => (
            <div
              className={`absolute z-20 hidden rounded-full border border-[color:var(--border)] bg-[color:var(--glass-strong)] px-4 py-2 text-xs font-semibold tracking-[0.16em] text-[color:var(--text)] uppercase shadow-[0_16px_44px_rgba(0,0,0,0.18)] backdrop-blur-md sm:flex ${chip.className}`}
              key={chip.label}
            >
              {chip.label}
            </div>
          ))}
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -14, 0], rotate: [-0.7, 0.7, -0.7] }}
            className="relative w-full"
            transition={reduceMotion ? undefined : { duration: 5.8, ease: "easeInOut", repeat: Infinity }}
          >
            {restaurant.heroProduct && safePublicImage(restaurant.heroProduct.imageUrl || restaurant.heroProduct.images[0]) ?
              <div className="relative z-10 aspect-square w-full overflow-hidden rounded-full border border-[color:var(--primary)]/35 shadow-[0_40px_70px_rgba(0,0,0,0.45)]"><PublicProductImage alt={restaurant.heroProduct.name} src={restaurant.heroProduct.imageUrl || restaurant.heroProduct.images[0]} sizes="(min-width: 1024px) 54vw, 100vw" className="object-cover" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-8 text-center text-lg font-semibold text-white">{restaurant.heroProduct.name}</span></div> : <Image
              alt=""
              className="relative z-10 h-auto w-full drop-shadow-[0_40px_70px_rgba(0,0,0,0.62)]"
              height={760}
              loading="eager"
              priority
              sizes="(min-width: 1024px) 54vw, 100vw"
              src="/home2.webp"
              width={760}
            />}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
