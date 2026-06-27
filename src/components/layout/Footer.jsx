"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import {
  ArrowRight,
  Camera,
  Clock,
  Mail,
  MapPin,
  Music2,
  Phone,
  Send,
  ThumbsUp,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

const footerEase = [0.16, 1, 0.3, 1];

const quickLinks = [
  { label: "Home", href: routes.home },
  { label: "Menu", href: routes.menu },
  { label: "About", href: routes.about },
  { label: "Contact", href: `${routes.home}#contact` },
];

const socialLinks = [
  { label: "Instagram", href: "https://instagram.com", icon: Camera },
  { label: "Facebook", href: "https://facebook.com", icon: ThumbsUp },
  { label: "Twitter/X", href: "https://x.com", icon: X },
  { label: "TikTok", href: "https://tiktok.com", icon: Music2 },
];

const restaurantInfo = [
  { label: "Phone", value: "+20 123 456 7890", href: "tel:+201234567890", icon: Phone },
  {
    label: "Email",
    value: "hello@savora.com",
    href: "mailto:hello@savora.com",
    icon: Mail,
  },
  { label: "Location", value: "Cairo, Egypt", icon: MapPin },
  { label: "Opening Hours", value: "Mon - Sun\n10:00 AM - 11:00 PM", icon: Clock },
];

const particles = [
  "left-[8%] top-[18%] size-1",
  "left-[24%] bottom-[18%] size-1.5",
  "right-[12%] top-[24%] size-1",
  "right-[30%] bottom-[16%] size-1",
  "left-[52%] top-[10%] size-1.5",
  "right-[46%] bottom-[32%] size-1",
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.12,
    },
  },
};

const columnVariants = {
  hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.78, ease: footerEase },
  },
};

function FooterHeading({ children }) {
  return (
    <h3 className="text-sm font-semibold tracking-[0.24em] text-[color:var(--gold)] uppercase">
      {children}
    </h3>
  );
}

function PremiumLink({ href, children }) {
  return (
    <Link
      className="group inline-flex w-fit items-center gap-2 text-sm text-[color:var(--text-muted)] transition-colors duration-300 hover:text-[color:var(--primary-light)]"
      href={href}
    >
      <span className="h-px w-0 bg-[color:var(--primary)] transition-all duration-300 group-hover:w-5" />
      {children}
    </Link>
  );
}

export default function Footer() {
  const isArabic = useLocale() === "ar";
  const displayedRestaurantInfo = restaurantInfo.map((item) => isArabic ? {
    ...item,
    label: ({Phone: "الهاتف", Email: "البريد الإلكتروني", Location: "الموقع", "Opening Hours": "ساعات العمل"})[item.label],
    value: item.label === "Location" ? "القاهرة، مصر" : item.label === "Opening Hours" ? "الاثنين - الأحد\n10:00 ص - 11:00 م" : item.value,
  } : item);
  return (
    <footer className="relative isolate overflow-hidden bg-[color:var(--background)] px-4 pt-20 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-20 bg-[image:var(--footer-background)]" />
      <motion.div
        className="absolute right-[-18rem] top-8 -z-10 size-[42rem] rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.22),rgba(255,122,0,0.08)_40%,transparent_72%)] blur-3xl"
        animate={{ opacity: [0.38, 0.72, 0.38], scale: [0.96, 1.07, 0.96] }}
        transition={{ duration: 8.5, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-[-18rem] left-[-14rem] -z-10 size-[38rem] rounded-full bg-[radial-gradient(circle,rgba(212,160,23,0.14),rgba(255,122,0,0.08)_42%,transparent_72%)] blur-3xl"
        animate={{ opacity: [0.3, 0.62, 0.3], scale: [1.05, 0.95, 1.05] }}
        transition={{ duration: 9.5, ease: "easeInOut", repeat: Infinity }}
      />
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[color:var(--primary)]/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 top-24 -z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent sm:inset-x-20" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 hidden w-px bg-gradient-to-b from-transparent via-[color:var(--primary)]/16 to-transparent lg:block" />

      {particles.map((className, index) => (
        <motion.span
          animate={{
            opacity: [0.1, 0.48, 0.1],
            scale: [0.75, 1.45, 0.75],
            x: [0, index % 2 === 0 ? 16 : -16, 0],
            y: [0, -28, 0],
          }}
          className={`absolute rounded-full bg-[color:var(--primary-light)]/70 shadow-[0_0_18px_rgba(255,157,51,0.72)] ${className}`}
          key={className}
          transition={{
            delay: index * 0.42,
            duration: 5.4 + index * 0.25,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      ))}

      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mx-auto mb-8 flex w-fit items-center gap-4 rounded-full border border-[color:var(--primary)]/25 bg-[color:var(--primary)]/10 px-4 py-2 text-xs font-semibold tracking-[0.28em] text-[color:var(--primary-light)] uppercase shadow-[0_0_34px_rgba(255,122,0,0.13)] backdrop-blur-xl"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: footerEase }}
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[color:var(--primary)]/80" />
          {isArabic ? "تجربة سافورا" : "Savora Experience"}
          <span className="size-1.5 rounded-full bg-[color:var(--primary-light)] shadow-[0_0_14px_rgba(255,157,51,0.9)]" />
        </motion.div>

        <motion.div
          animate={{ y: [0, -8, 0] }}
          className="relative mb-16 overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.035)_54%,rgba(255,122,0,0.07))] p-6 shadow-[0_34px_110px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-8 lg:p-10"
          initial={{ opacity: 0, y: 36, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.9, ease: footerEase }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(255,255,255,0.12),transparent_25%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_38%,rgba(255,122,0,0.12))]" />
          <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[color:var(--primary)]/22 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="relative grid items-center gap-7 lg:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-3xl font-semibold leading-tight text-balance text-[color:var(--text)] sm:text-4xl lg:text-5xl">
                {isArabic ? "هل أنت مستعد لتجربة سافورا؟" : "Ready to Experience Savora?"}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">
                {isArabic ? "اكتشف أطباقًا مصنوعة بإتقان ومكونات فاخرة ولحظات طعام لا تُنسى." : "Discover handcrafted dishes, premium ingredients, and unforgettable dining moments."}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <motion.div whileHover={{ y: -4, scale: 1.025 }} whileTap={{ scale: 0.98 }}>
                <Link
                  className="group inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-7 text-sm font-bold text-[color:var(--background)] shadow-[0_20px_56px_rgba(255,122,0,0.36)] transition-all duration-300 hover:shadow-[0_26px_70px_rgba(255,122,0,0.5)] sm:w-auto"
                  href={routes.menu}
                >
                  {isArabic ? "اطلب الآن" : "Order Now"}
                  <ArrowRight
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                    size={18}
                  />
                </Link>
              </motion.div>
              <motion.div whileHover={{ y: -3, scale: 1.018 }} whileTap={{ scale: 0.98 }}>
                <Link
                  className="inline-flex min-h-13 w-full items-center justify-center rounded-full border border-white/14 bg-white/[0.045] px-7 text-sm font-bold text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur transition-all duration-300 hover:border-[color:var(--primary)]/55 hover:bg-white/[0.08] hover:text-[color:var(--primary-light)] sm:w-auto"
                  href={routes.menu}
                >
                  {isArabic ? "عرض القائمة" : "View Menu"}
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="grid gap-10 border-y border-white/10 py-12 sm:grid-cols-2 lg:grid-cols-[1.24fr_0.76fr_1fr_1.06fr] lg:gap-9 lg:py-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.18 }}
          variants={containerVariants}
        >
          <motion.div variants={columnVariants}>
            <Link className="group inline-flex items-center" href={routes.home} aria-label="Savora home">
              <span className="relative block h-14 w-40 overflow-hidden">
                <Image
                  alt="Savora"
                  className="absolute -left-12 -top-[3.25rem] h-[8.75rem] w-[13.125rem] max-w-none object-contain transition-transform duration-300 group-hover:scale-105"
                  height={1024}
                  priority
                  src="/headIcon.png"
                  width={1536}
                />
              </span>
            </Link>
            <h2 className="mt-5 text-2xl font-semibold tracking-[0.22em] text-[color:var(--text)]">
              SAVORA
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[color:var(--text-muted)]">
              {isArabic ? "نصنع تجارب طعام لا تُنسى بمكونات فاخرة وطهاة خبراء وخدمة استثنائية." : "Crafting unforgettable dining experiences through premium ingredients, expert chefs, and exceptional service."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;

                return (
                  <motion.a
                    aria-label={social.label}
                    className="group flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[color:var(--text-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur transition-all duration-300 hover:border-[color:var(--primary)]/55 hover:bg-[color:var(--primary)]/12 hover:text-[color:var(--primary-light)] hover:shadow-[0_0_34px_rgba(255,122,0,0.24)]"
                    href={social.href}
                    key={social.label}
                    rel="noreferrer"
                    target="_blank"
                    whileHover={{ y: -4, scale: 1.08 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                  </motion.a>
                );
              })}
            </div>
          </motion.div>

          <motion.div variants={columnVariants}>
            <FooterHeading>{isArabic ? "روابط سريعة" : "Quick Links"}</FooterHeading>
            <nav className="mt-6 grid gap-3">
              {quickLinks.map((link) => (
                <PremiumLink href={link.href} key={link.label}>
                  {isArabic ? ({Home: "الرئيسية", Menu: "القائمة", About: "من نحن", Contact: "تواصل معنا"})[link.label] : link.label}
                </PremiumLink>
              ))}
            </nav>
          </motion.div>

          <motion.div variants={columnVariants}>
            <FooterHeading>{isArabic ? "معلومات المطعم" : "Restaurant Information"}</FooterHeading>
            <div className="mt-6 grid gap-4">
              {displayedRestaurantInfo.map((item) => {
                const Icon = item.icon;
                const content = (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--primary)]/20 bg-[color:var(--primary)]/9 text-[color:var(--primary-light)]">
                      <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
                    </span>
                    <span>
                      <span className="block text-[0.65rem] font-semibold tracking-[0.2em] text-[color:var(--gold)] uppercase">
                        {item.label}
                      </span>
                      <span className="mt-1 block whitespace-pre-line text-sm leading-6 text-[color:var(--text-muted)] transition-colors duration-300 group-hover:text-[color:var(--text)]">
                        {item.value}
                      </span>
                    </span>
                  </>
                );

                return item.href ? (
                  <a
                    className="group flex items-start gap-3 rounded-2xl border border-white/0 p-1 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.035]"
                    href={item.href}
                    key={item.label}
                  >
                    {content}
                  </a>
                ) : (
                  <div className="group flex items-start gap-3 p-1" key={item.label}>
                    {content}
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div variants={columnVariants}>
            <FooterHeading>{isArabic ? "انضم إلى نشرتنا" : "Join Our Newsletter"}</FooterHeading>
            <p className="mt-6 text-sm leading-7 text-[color:var(--text-muted)]">
              {isArabic ? "احصل على تحديثات الأطباق الجديدة والعروض والتجارب الحصرية." : "Get updates on new dishes, offers, and exclusive dining experiences."}
            </p>
            <form
              className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl"
              onSubmit={(event) => event.preventDefault()}
            >
              <label className="sr-only" htmlFor="footer-email">
                {isArabic ? "البريد الإلكتروني" : "Email Address"}
              </label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] lg:grid-cols-1 xl:grid-cols-[1fr_auto]">
                <input
                  className="h-12 rounded-[1rem] border border-white/10 bg-[color:var(--background)]/72 px-4 text-sm text-[color:var(--text)] outline-none transition-all duration-300 placeholder:text-[color:var(--text-muted)]/55 hover:border-white/18 focus:border-[color:var(--primary)]/70 focus:shadow-[0_0_0_4px_rgba(255,122,0,0.12),0_16px_42px_rgba(255,122,0,0.1)]"
                  id="footer-email"
                  placeholder={isArabic ? "البريد الإلكتروني" : "Email Address"}
                  type="email"
                />
                <motion.button
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-5 text-sm font-bold text-[color:var(--background)] shadow-[0_16px_44px_rgba(255,122,0,0.28)] transition-all duration-300 hover:shadow-[0_22px_58px_rgba(255,122,0,0.42)]"
                  type="submit"
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isArabic ? "اشترك" : "Subscribe"}
                  <Send
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                    size={16}
                    strokeWidth={2}
                  />
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>

        <div className="flex flex-col gap-5 py-7 text-sm text-[color:var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Savora. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="transition-colors duration-300 hover:text-[color:var(--primary-light)]"
              href={routes.home}
            >
              {isArabic ? "سياسة الخصوصية" : "Privacy Policy"}
            </Link>
            <span className="h-4 w-px bg-white/14" />
            <Link
              className="transition-colors duration-300 hover:text-[color:var(--primary-light)]"
              href={routes.home}
            >
              {isArabic ? "شروط الخدمة" : "Terms of Service"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
