"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import type { Restaurant } from "@/types";

export function HeroSection({ restaurant }: { restaurant: Restaurant }) {
  const isArabic = useLocale() === "ar";
  const stats = [
    { value: "+5000", label: isArabic ? "طلب" : "Orders" },
    { value: "4.9", label: isArabic ? "التقييم" : "Rating" },
    { value: isArabic ? "طازجة" : "Fresh", label: isArabic ? "المكونات" : "Ingredients" },
  ];

  const particles = [
    { className: "left-[8%] top-[20%] size-2", delay: 0 },
    { className: "left-[18%] bottom-[22%] size-1.5", delay: 0.8 },
    { className: "right-[46%] top-[16%] size-2", delay: 1.3 },
    { className: "right-[12%] top-[26%] size-1.5", delay: 0.45 },
    { className: "right-[18%] bottom-[18%] size-2", delay: 1.1 },
    { className: "left-[48%] bottom-[30%] size-1.5", delay: 1.7 },
    { className: "left-[31%] top-[55%] size-1", delay: 2.1 },
    { className: "right-[33%] bottom-[38%] size-1", delay: 2.6 },
  ];

  const flavorChips = [
    { label: "Smoky Char", className: "left-4 top-[18%]", delay: 0.2 },
    { label: "Melted Cheddar", className: "right-0 top-[28%]", delay: 0.8 },
    { label: "Toasted Brioche", className: "bottom-[18%] left-[12%]", delay: 1.4 },
  ];

  return (
    <section className="relative isolate flex min-h-[calc(100svh-73px)] overflow-hidden bg-[color:var(--background)] px-4 py-8 text-[color:var(--text)] sm:px-6 sm:py-10 lg:px-8">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_80%_44%,rgba(255,122,0,0.18),transparent_34%),linear-gradient(135deg,rgba(31,31,31,0.96),rgba(13,13,13,0.98)_48%,rgba(13,13,13,1))]" />
      <motion.div
        animate={{ opacity: [0.18, 0.42, 0.2], scale: [0.92, 1.12, 0.96] }}
        className="absolute right-[-12%] top-[8%] -z-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.22),transparent_68%)] blur-3xl"
        transition={{ duration: 5, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        animate={{ x: ["-20%", "12%", "-10%"], opacity: [0.08, 0.18, 0.08] }}
        className="absolute inset-y-0 left-0 -z-10 w-2/3 bg-[linear-gradient(110deg,transparent,rgba(255,157,51,0.16),transparent)] blur-2xl"
        transition={{ duration: 7, ease: "easeInOut", repeat: Infinity }}
      />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[color:var(--background)] to-transparent" />

      {particles.map((particle, index) => (
        <motion.span
          animate={
            {
              opacity: [0.12, 0.95, 0.18],
              scale: [0.8, 1.7, 0.9],
              x: [0, index % 2 === 0 ? 18 : -18, 0],
              y: [0, -42, 0],
            }
          }
          className={`absolute rounded-full bg-[color:var(--primary-light)] shadow-[0_0_22px_rgba(255,157,51,0.95)] ${particle.className}`}
          key={particle.className}
          transition={{
            delay: particle.delay,
            duration: 3.6 + index * 0.2,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      ))}

      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 sm:gap-12 lg:grid-cols-[0.92fr_1.08fr]">
        <motion.div
          className="order-2 max-w-3xl text-center lg:order-1 lg:pt-0 lg:text-left"
          initial={{ opacity: 0, x: -34 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.75, ease: "easeOut" }}
        >
          <motion.div
            className="relative mx-auto mb-5 inline-flex overflow-hidden rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-[color:var(--primary-light)] uppercase shadow-[0_0_28px_rgba(255,122,0,0.18)] sm:mb-6 sm:tracking-[0.22em] lg:mx-0"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8, ease: "easeOut" }}
          >
            <motion.span
              animate={{ scale: [1, 1.45, 1], opacity: [0.7, 1, 0.7] }}
              className="mt-1 size-1.5 rounded-full bg-[color:var(--primary-light)] shadow-[0_0_14px_rgba(255,157,51,0.95)]"
              transition={{ duration: 1.7, ease: "easeInOut", repeat: Infinity }}
            />
            {isArabic ? "حِرفية فاخرة مشوية على اللهب" : "Premium flame-grilled craft"}
            <motion.span
              animate={{ x: ["-140%", "260%"] }}
              className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              transition={{ duration: 2.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.2 }}
            />
          </motion.div>

          <motion.h1
            className="text-4xl leading-[0.98] font-semibold text-balance text-[color:var(--text)] sm:text-6xl "
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.8, ease: "easeOut" }}
          >
            {isArabic ? "برجر مصنوع بإتقان" : "Crafted Burgers"}
            <span className="block text-[color:var(--primary-light)]">
              {isArabic ? "يجعل كل لقمة ذكرى" : "That Make Every Bite Memorable"}
            </span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-lg lg:mx-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.65 }}
          >
            {restaurant.description}{" "}
            {isArabic
              ? "يُقدّم بتحمير مثالي وخبز بريوش دافئ ونكهات غنية تجعل العشاء تجربة لا تُنسى."
              : "Served with a cinematic char, warm brioche, and the kind of layered flavor that turns dinner into a ritual."}
          </motion.p>

          <motion.div
            className="mt-6 flex flex-col justify-center gap-3 sm:mt-7 sm:flex-row sm:gap-4 lg:justify-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.65 }}
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.9, ease: "easeInOut", repeat: Infinity }}
              whileHover={{ y: -6, scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-8 text-sm font-bold tracking-wide text-[color:var(--background)] shadow-[0_18px_48px_rgba(255,122,0,0.36)] transition-colors duration-300 hover:bg-[color:var(--primary-light)] sm:w-auto"
                href={routes.menu}
              >
                {isArabic ? "اطلب الآن" : "Order Now"}
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                className="inline-flex min-h-13 w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-8 text-sm font-bold tracking-wide text-[color:var(--text)] backdrop-blur transition-colors duration-300 hover:border-[color:var(--primary-light)]/50 hover:bg-white/[0.08] sm:w-auto"
                href={routes.menu}
              >
              {isArabic ? "من نحن" : "About Us"}
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            className="mt-6 grid grid-cols-3 overflow-hidden rounded-md border border-white/10 bg-white/[0.035] backdrop-blur sm:mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.65 }}
          >
            {stats.map((stat) => (
              <div
                className="border-r border-white/10 px-2 py-3 text-center last:border-r-0 sm:px-5 sm:py-4 lg:text-left"
                key={stat.label}
              >
                <div className="text-xl font-semibold text-[color:var(--text)] sm:text-3xl">
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
          transition={{ delay: 0.25, duration: 0.8, ease: "easeOut" }}
        >
          <motion.div
            animate={{ opacity: [0.52, 0.92, 0.58], scale: [0.86, 1.08, 0.9] }}
            className="absolute inset-8 rounded-full bg-[radial-gradient(circle,rgba(255,157,51,0.58),rgba(255,122,0,0.24)_38%,transparent_68%)] blur-2xl"
            transition={{ duration: 3.8, ease: "easeInOut", repeat: Infinity }}
          />
          <motion.div
            animate={{ rotate: 360 }}
            className="absolute h-[62%] w-[62%] rounded-full border border-dashed border-[color:var(--gold)]/25 shadow-[0_0_90px_rgba(255,122,0,0.24)]"
            transition={{ duration: 22, ease: "linear", repeat: Infinity }}
          />
          {flavorChips.map((chip) => (
            <motion.div
              animate={{ opacity: [0.72, 1, 0.72], y: [0, -12, 0] }}
              className={`absolute z-20 hidden rounded-full border border-white/10 bg-[color:var(--card)]/70 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-[color:var(--text)] uppercase shadow-[0_16px_44px_rgba(0,0,0,0.38)] backdrop-blur-md sm:flex ${chip.className}`}
              key={chip.label}
              transition={{
                delay: chip.delay,
                duration: 3.2,
                ease: "easeInOut",
                repeat: Infinity,
              }}
            >
              {isArabic
                ? ({"Smoky Char": "تحمير مدخن", "Melted Cheddar": "شيدر ذائب", "Toasted Brioche": "بريوش محمص"} as Record<string, string>)[chip.label]
                : chip.label}
            </motion.div>
          ))}
          <motion.div
            animate={{ y: [0, -26, 0], rotate: [-1.5, 1.5, -1.5], scale: [1, 1.025, 1] }}
            className="relative w-full"
            transition={{ duration: 4.2, ease: "easeInOut", repeat: Infinity }}
          >
            <Image
              alt="Premium stacked burger with toasted bun"
              className="relative z-10 h-auto w-full drop-shadow-[0_40px_70px_rgba(0,0,0,0.62)]"
              height={760}
              priority
              src="/home2.png"
              width={760}
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
