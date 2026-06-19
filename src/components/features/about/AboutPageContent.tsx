"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  HeartHandshake,
  Leaf,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

const sectionEase = [0.16, 1, 0.3, 1] as const;

const stats = [
  { value: "10+", label: "Years Experience" },
  { value: "50+", label: "Signature Dishes" },
  { value: "5000+", label: "Happy Guests" },
];

const valuePoints = ["Premium Ingredients", "Warm Hospitality", "Crafted With Passion"];

const timelineItems = [
  {
    year: "2018",
    title: "The First Spark",
    description:
      "Savora started with a simple idea: create a restaurant where premium food feels warm, personal, and unforgettable.",
  },
  {
    year: "2020",
    title: "Signature Recipes",
    description:
      "Our chefs developed a collection of handcrafted dishes combining classic comfort food with modern presentation.",
  },
  {
    year: "2023",
    title: "A Premium Dining Identity",
    description:
      "Savora evolved into a luxury-inspired restaurant brand focused on atmosphere, service, and memorable taste.",
  },
  {
    year: "2026",
    title: "The Digital Experience",
    description:
      "Savora now brings its menu, orders, and restaurant experience online with a modern digital platform.",
  },
];

const values: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Freshness First",
    description:
      "We select high-quality ingredients every day to keep each plate rich, vibrant, and fresh.",
    icon: Leaf,
  },
  {
    title: "Crafted Flavor",
    description: "Every recipe is balanced with care to deliver bold, memorable taste.",
    icon: Flame,
  },
  {
    title: "Guest Experience",
    description:
      "From the first welcome to the last bite, we focus on comfort, quality, and care.",
    icon: HeartHandshake,
  },
  {
    title: "Modern Dining",
    description:
      "We combine premium restaurant atmosphere with a smooth digital ordering experience.",
    icon: Sparkles,
  },
];

const openingHours = [
  { day: "Monday - Thursday", time: "10:00 AM - 11:00 PM" },
  { day: "Friday - Saturday", time: "10:00 AM - 12:00 AM", highlight: true },
  { day: "Sunday", time: "12:00 PM - 10:00 PM" },
];

const particles = [
  "left-[8%] top-[13%] size-1.5",
  "left-[16%] top-[44%] size-1",
  "left-[31%] bottom-[18%] size-1.5",
  "right-[10%] top-[20%] size-1",
  "right-[24%] top-[52%] size-1.5",
  "right-[38%] bottom-[22%] size-1",
];

const fadeUp = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.78, ease: sectionEase },
  },
};

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 inline-flex max-w-full items-center gap-3 rounded-full border border-[color:var(--primary)]/30 bg-[linear-gradient(135deg,rgba(255,122,0,0.14),rgba(255,255,255,0.035))] px-3 py-2 text-[0.68rem] font-semibold tracking-[0.2em] text-[color:var(--primary-light)] uppercase shadow-[0_0_34px_rgba(255,122,0,0.14),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur sm:gap-4 sm:px-4 sm:tracking-[0.24em]">
      <span className="h-px w-6 bg-gradient-to-r from-transparent to-[color:var(--primary)]/80 sm:w-8" />
      {children}
      <span className="size-1.5 rounded-full bg-[color:var(--primary-light)] shadow-[0_0_14px_rgba(255,157,51,0.9)]" />
    </div>
  );
}

function MotionSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <motion.section
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeUp}
    >
      {children}
    </motion.section>
  );
}

function TimelineCard({
  item,
  align,
}: {
  item: (typeof timelineItems)[number];
  align: "left" | "right";
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.028)_58%,rgba(255,122,0,0.05))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-xl transition-all duration-500 hover:border-[color:var(--primary)]/48 hover:shadow-[0_30px_90px_rgba(255,122,0,0.13)] sm:p-6 ${
        align === "left" ? "sm:text-right" : ""
      }`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-36 rounded-full bg-[color:var(--primary)]/0 blur-2xl transition-colors duration-500 group-hover:bg-[color:var(--primary)]/16" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div
        className={`flex items-center gap-3 ${align === "left" ? "sm:justify-end" : ""}`}
      >
        <span className="rounded-full border border-[color:var(--gold)]/28 bg-[color:var(--gold)]/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-[color:var(--gold)] uppercase">
          {item.year}
        </span>
      </div>
      <h3 className="mt-4 text-2xl font-semibold leading-tight text-[color:var(--text)]">
        {item.title}
      </h3>
      <p className="mt-4 text-sm leading-7 text-[color:var(--text-muted)]">
        {item.description}
      </p>
    </div>
  );
}

export function AboutPageContent() {
  return (
    <main className="overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]">
      <section className="relative isolate flex min-h-[calc(100svh-74px)] items-center overflow-hidden px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_18%,rgba(255,157,51,0.14),transparent_32%),radial-gradient(circle_at_84%_34%,rgba(255,122,0,0.18),transparent_30%),linear-gradient(135deg,rgba(31,31,31,0.86),rgba(13,13,13,1)_52%,rgba(13,13,13,1))]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[color:var(--background)] to-transparent" />
        <div className="absolute left-1/2 top-10 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.24),transparent_68%)] blur-3xl" />
        <div className="absolute left-[12%] top-[26%] -z-10 hidden h-44 w-px bg-gradient-to-b from-transparent via-[color:var(--primary)]/48 to-transparent lg:block" />
        <div className="absolute right-[16%] bottom-[24%] -z-10 hidden h-px w-56 bg-gradient-to-r from-transparent via-[color:var(--gold)]/32 to-transparent lg:block" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(115deg,transparent_0%,transparent_42%,rgba(255,122,0,0.07)_43%,transparent_45%,transparent_100%)]" />

        {particles.map((particle) => (
          <span
            className={`absolute rounded-full bg-[color:var(--primary-light)]/75 shadow-[0_0_20px_rgba(255,157,51,0.72)] ${particle}`}
            key={particle}
          />
        ))}

        <div className="mx-auto w-full max-w-7xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: sectionEase }}
          >
            <SectionBadge>About Savora</SectionBadge>
          </motion.div>
          <motion.h1
            className="mx-auto max-w-5xl text-[clamp(3.1rem,9vw,6.8rem)] font-semibold leading-[0.92] text-balance"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.78, ease: sectionEase }}
          >
            Where Flavor Meets
            <span className="block text-[color:var(--primary-light)] drop-shadow-[0_0_32px_rgba(255,122,0,0.22)]">
              Elegant Dining
            </span>
          </motion.h1>
          <motion.p
            className="mx-auto mt-7 max-w-3xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg sm:leading-9"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.72, ease: sectionEase }}
          >
            Savora is a premium restaurant experience built around handcrafted dishes,
            warm hospitality, and unforgettable flavors served in a cinematic dining
            atmosphere.
          </motion.p>

          <motion.div
            className="mx-auto mt-10 grid max-w-4xl overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.075),rgba(255,255,255,0.026)_60%,rgba(255,122,0,0.045))] shadow-[0_24px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:grid-cols-3"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.72, ease: sectionEase }}
          >
            {stats.map((stat) => (
              <div
                className="border-b border-white/10 px-5 py-5 text-center last:border-b-0 sm:border-b-0 sm:border-r sm:px-7 sm:py-6 sm:last:border-r-0"
                key={stat.label}
              >
                <div className="text-3xl font-semibold text-[color:var(--text)] sm:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-2 text-xs font-semibold tracking-[0.18em] text-[color:var(--text-muted)] uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <MotionSection className="relative px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute right-[-16rem] top-16 -z-10 size-[36rem] rounded-full bg-[radial-gradient(circle,rgba(212,160,23,0.1),transparent_70%)] blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 xl:gap-20">
          <div>
            <SectionBadge>Our Identity</SectionBadge>
            <h2 className="text-4xl font-semibold leading-[1.02] text-balance sm:text-5xl lg:text-6xl">
              Who We Are
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg sm:leading-9">
              We are a modern restaurant brand inspired by the art of slow dining,
              premium ingredients, and bold flavors. Every dish is designed to feel
              personal, memorable, and beautifully crafted.
            </p>
            <div className="mt-9 grid gap-3 sm:max-w-xl sm:grid-cols-3">
              {valuePoints.map((point) => (
                <div
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur"
                  key={point}
                >
                  <span className="mb-3 flex size-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 text-[color:var(--primary-light)]">
                    <CheckCircle2 aria-hidden="true" size={18} strokeWidth={1.9} />
                  </span>
                  <span className="block text-sm font-semibold leading-6 text-[color:var(--text)]">
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-[radial-gradient(circle,rgba(255,157,51,0.24),rgba(255,122,0,0.08)_42%,transparent_72%)] blur-2xl" />
            <div className="absolute -left-5 top-14 z-10 hidden rounded-full border border-[color:var(--gold)]/30 bg-[color:var(--background)]/78 px-5 py-2 text-xs font-semibold tracking-[0.22em] text-[color:var(--gold)] uppercase shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-md sm:block">
              Slow Dining
            </div>
            <div className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-[color:var(--card)]/55 p-2 shadow-[0_34px_100px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="relative min-h-[26rem] overflow-hidden rounded-[1.55rem] sm:min-h-[38rem] lg:min-h-[42rem]">
                <Image
                  alt="Premium Savora dining table with handcrafted dish"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  src="/whyChooseUs.png"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)]/62 via-transparent to-black/10" />
                <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/10 bg-[color:var(--background)]/68 px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-md sm:inset-x-5 sm:bottom-5">
                  <div className="text-xs font-semibold tracking-[0.22em] text-[color:var(--gold)] uppercase">
                    Handcrafted Atmosphere
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                    Built for slow evenings, refined plates, and warm conversation.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MotionSection>

      <MotionSection className="relative px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(13,13,13,1),rgba(31,31,31,0.58),rgba(13,13,13,1))]" />
        <div className="absolute left-[-18rem] top-20 -z-10 size-[42rem] rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.12),transparent_70%)] blur-3xl" />
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <SectionBadge>Our Story</SectionBadge>
            <h2 className="mx-auto max-w-4xl text-4xl font-semibold leading-[1.02] text-balance sm:text-5xl lg:text-6xl">
              From First Spark to Digital Dining
            </h2>
          </div>
          <div className="relative mt-14 sm:mt-16 lg:mt-[4.5rem]">
            <div className="absolute bottom-3 left-4 top-3 w-px bg-gradient-to-b from-transparent via-[color:var(--primary)]/90 to-transparent sm:left-1/2 sm:-translate-x-1/2" />
            <div className="grid gap-7 sm:gap-8">
              {timelineItems.map((item, index) => (
                <motion.article
                  className="relative grid pl-11 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] sm:items-center sm:pl-0"
                  initial={{ opacity: 0, y: 26 }}
                  key={item.year}
                  transition={{ delay: index * 0.08, duration: 0.68, ease: sectionEase }}
                  viewport={{ once: true, amount: 0.35 }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <div className="absolute left-4 top-7 flex -translate-x-1/2 items-center justify-center sm:static sm:col-start-2 sm:row-start-1 sm:translate-x-0">
                    <span className="relative flex size-8 items-center justify-center rounded-full border border-[color:var(--primary-light)]/65 bg-[color:var(--background)] shadow-[0_0_28px_rgba(255,122,0,0.58)]">
                      <span className="absolute size-14 rounded-full border border-[color:var(--primary)]/18" />
                      <span className="size-2.5 rounded-full bg-[color:var(--primary-light)] shadow-[0_0_18px_rgba(255,157,51,0.88)]" />
                    </span>
                  </div>
                  <div
                    className={`sm:row-start-1 ${
                      index % 2 === 0 ? "sm:col-start-1" : "sm:col-start-3"
                    }`}
                  >
                    <TimelineCard item={item} align={index % 2 === 0 ? "left" : "right"} />
                  </div>
                  <div
                    className={`hidden h-px bg-gradient-to-r sm:row-start-1 sm:block ${
                      index % 2 === 0
                        ? "sm:col-start-2 sm:ml-10 sm:bg-gradient-to-r sm:from-[color:var(--primary)]/45 sm:to-transparent"
                        : "sm:col-start-2 sm:mr-10 sm:bg-gradient-to-l sm:from-[color:var(--primary)]/45 sm:to-transparent"
                    }`}
                  />
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </MotionSection>

      <MotionSection className="relative px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1fr] lg:items-end">
            <div className="max-w-3xl">
            <SectionBadge>Our Values</SectionBadge>
            <h2 className="text-4xl font-semibold leading-[1.02] text-balance sm:text-5xl lg:text-6xl">
              Premium standards in every detail.
            </h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-[color:var(--text-muted)] lg:justify-self-end">
              Every service choice is designed to feel composed, generous, and
              unmistakably Savora.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value, index) => {
              const Icon = value.icon;

              return (
                <motion.article
                  className="group relative min-h-64 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.028)_58%,rgba(255,122,0,0.04))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-[color:var(--primary)]/55 hover:shadow-[0_32px_92px_rgba(255,122,0,0.16)] lg:min-h-72"
                  initial={{ opacity: 0, y: 26 }}
                  key={value.title}
                  transition={{ delay: index * 0.07, duration: 0.68, ease: sectionEase }}
                  viewport={{ once: true, amount: 0.35 }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <div className="absolute -right-16 -top-16 size-36 rounded-full bg-[color:var(--primary)]/0 blur-2xl transition-colors duration-500 group-hover:bg-[color:var(--primary)]/18" />
                  <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <div className="mb-6 flex size-14 items-center justify-center rounded-[1.15rem] border border-[color:var(--primary)]/28 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)] shadow-[0_0_32px_rgba(255,122,0,0.15)]">
                    <Icon aria-hidden="true" size={23} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-xl font-semibold transition-colors duration-300 group-hover:text-[color:var(--primary-light)]">
                    {value.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--text-muted)]">
                    {value.description}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </MotionSection>

      <MotionSection className="relative px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_78%_18%,rgba(255,122,0,0.11),transparent_32%),linear-gradient(180deg,rgba(13,13,13,1),rgba(31,31,31,0.42),rgba(13,13,13,1))]" />
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-8">
          <div className="relative overflow-hidden rounded-[1.6rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.095),rgba(255,255,255,0.035)_52%,rgba(255,122,0,0.06))] p-6 shadow-[0_34px_100px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 size-52 rounded-full bg-[color:var(--primary)]/16 blur-3xl" />
            <div className="relative">
            <div className="flex items-center gap-4">
              <span className="flex size-13 items-center justify-center rounded-full border border-[color:var(--primary)]/35 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)] shadow-[0_0_30px_rgba(255,122,0,0.2)]">
                <Clock aria-hidden="true" size={22} strokeWidth={1.8} />
              </span>
              <h2 className="text-3xl font-semibold sm:text-4xl">Opening Hours</h2>
            </div>
            <div className="mt-8 divide-y divide-white/10 rounded-lg border border-white/8 bg-[color:var(--background)]/26 px-4">
              {openingHours.map((row) => (
                <div
                  className={`flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between ${
                    row.highlight
                      ? "rounded-md bg-[color:var(--primary)]/9 px-3 text-[color:var(--primary-light)] sm:-mx-1"
                      : "text-[color:var(--text)]"
                  }`}
                  key={row.day}
                >
                  <span className="font-semibold">{row.day}</span>
                  <span className="text-sm text-[color:var(--text-muted)] sm:text-right">
                    {row.time}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 rounded-lg border border-[color:var(--gold)]/25 bg-[color:var(--gold)]/8 px-4 py-3 text-sm leading-6 text-[color:var(--text-muted)]">
              Kitchen closes 30 minutes before closing time.
            </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[1.6rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.085),rgba(255,255,255,0.028)_58%,rgba(255,122,0,0.052))] p-5 shadow-[0_34px_100px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-2xl sm:p-8">
            <div className="absolute -right-24 -top-24 size-60 rounded-full bg-[color:var(--primary)]/18 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <SectionBadge>Location</SectionBadge>
                <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                  Visit Our Restaurant
                </h2>
                <div className="mt-7 grid gap-3 text-sm text-[color:var(--text-muted)]">
                  <div className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-3">
                    <MapPin className="mt-0.5 shrink-0 text-[color:var(--primary-light)]" size={18} />
                    <span>Downtown, Cairo, Egypt</span>
                  </div>
                  <a className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-3 transition-colors hover:text-[color:var(--primary-light)]" href="tel:+201234567890">
                    <Phone className="mt-0.5 shrink-0 text-[color:var(--primary-light)]" size={18} />
                    <span>+20 123 456 7890</span>
                  </a>
                  <a className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-3 transition-colors hover:text-[color:var(--primary-light)]" href="mailto:hello@savora.com">
                    <Mail className="mt-0.5 shrink-0 text-[color:var(--primary-light)]" size={18} />
                    <span>hello@savora.com</span>
                  </a>
                </div>
              </div>

              <div className="relative min-h-[23rem] overflow-hidden rounded-[1.25rem] border border-white/10 bg-[color:var(--background)]/74 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:min-h-[25rem]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_48%,rgba(255,122,0,0.14),transparent_26%),linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:auto,34px_34px,34px_34px]" />
                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/[0.055] to-transparent" />
                <div className="absolute left-[-12%] top-[55%] h-4 w-[126%] -rotate-12 rounded-full bg-[color:var(--primary)]/18 shadow-[0_0_24px_rgba(255,122,0,0.14)]" />
                <div className="absolute right-[-18%] top-[27%] h-2.5 w-[96%] rotate-[35deg] rounded-full bg-white/10" />
                <div className="absolute left-[8%] bottom-[22%] h-2.5 w-[84%] rotate-12 rounded-full bg-[color:var(--gold)]/16" />
                <div className="absolute left-[16%] top-[18%] rounded-full border border-white/10 bg-[color:var(--background)]/68 px-3 py-1 text-[0.63rem] font-semibold tracking-[0.18em] text-white/45 uppercase">
                  Nile Avenue
                </div>
                <div className="absolute right-[10%] top-[12%] flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.62rem] font-semibold text-[color:var(--gold)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  N
                </div>
                <div className="absolute bottom-[27%] right-[12%] rounded-full border border-white/10 bg-[color:var(--background)]/68 px-3 py-1 text-[0.63rem] font-semibold tracking-[0.18em] text-white/45 uppercase">
                  Opera Lane
                </div>
                <div className="absolute left-1/2 top-[46%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center sm:top-1/2">
                  <span className="relative flex size-16 items-center justify-center rounded-full border border-[color:var(--primary)]/55 bg-[color:var(--primary)]/16 text-[color:var(--primary-light)] shadow-[0_0_44px_rgba(255,122,0,0.48)]">
                    <span className="absolute size-28 rounded-full border border-[color:var(--primary)]/20" />
                    <span className="absolute size-40 rounded-full border border-[color:var(--primary)]/10" />
                    <MapPin aria-hidden="true" size={30} strokeWidth={1.8} />
                  </span>
                  <span className="mt-4 rounded-lg border border-white/10 bg-[color:var(--background)]/82 px-4 py-2 text-center text-xs font-semibold tracking-[0.16em] uppercase shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur">
                    Savora Restaurant
                  </span>
                </div>
                <a
                  className="absolute inset-x-4 bottom-4 inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-5 py-3 text-sm font-bold text-[color:var(--background)] shadow-[0_18px_48px_rgba(255,122,0,0.32)] transition-transform hover:-translate-y-0.5 sm:inset-x-auto sm:right-5"
                  href="https://www.google.com/maps"
                  rel="noreferrer"
                  target="_blank"
                >
                  Get Directions
                  <Navigation aria-hidden="true" size={16} strokeWidth={2} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </MotionSection>

      <section className="relative px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.035)_54%,rgba(255,122,0,0.07))] p-8 text-center shadow-[0_34px_110px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-10 lg:p-12"
            initial={{ opacity: 0, y: 34, filter: "blur(8px)" }}
            transition={{ duration: 0.82, ease: sectionEase }}
            viewport={{ once: true, amount: 0.35 }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          >
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[color:var(--primary)]/22 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 left-10 size-72 rounded-full bg-[color:var(--gold)]/12 blur-3xl" />
            <div className="relative">
              <h2 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight text-balance sm:text-5xl">
                Ready to Taste the Savora Experience?
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">
                Explore our handcrafted menu and place your next order in just a few
                clicks.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  className="inline-flex min-h-13 items-center justify-center gap-3 rounded-full border border-white/14 bg-white/[0.045] px-7 text-sm font-bold text-[color:var(--text)] backdrop-blur transition-all duration-300 hover:border-[color:var(--primary)]/55 hover:bg-white/[0.08] hover:text-[color:var(--primary-light)]"
                  href={routes.menu}
                >
                  View Menu
                  <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
                </Link>
                <Link
                  className="inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-7 text-sm font-bold text-[color:var(--background)] shadow-[0_20px_56px_rgba(255,122,0,0.36)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_70px_rgba(255,122,0,0.5)]"
                  href={routes.menu}
                >
                  Order Now
                  <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
