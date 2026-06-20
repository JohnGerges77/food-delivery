"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Languages, ShoppingCart } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

export function PublicNavbar() {
  const t = useTranslations("navigation");
  const locale = useLocale();
  const pathname = usePathname();
  const nextLocale = locale === "ar" ? "en" : "ar";
  const links = [
    { href: routes.home, label: t("home") },
    { href: routes.menu, label: t("menu") },
    { href: routes.about, label: t("about") },
    { href: `${routes.home}#contact`, label: t("contact") },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[color:var(--background)]/75 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:px-6">
      <div className="mx-auto grid max-w-7xl grid-cols-2 items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
        <Link
          className="group inline-flex w-fit items-center"
          href={routes.home}
          aria-label={t("brand")}
        >
          <span className="relative block h-12 w-36 overflow-hidden sm:h-14 sm:w-40 lg:h-12 lg:w-36">
            <Image
              src="/headIcon.png"
              alt={t("brand")}
              width={1536}
              height={1024}
              priority
              className="absolute -left-12 -top-[3.25rem] h-[8.75rem] w-[13.125rem] max-w-none object-contain transition-transform duration-300 group-hover:scale-105 sm:-left-14 sm:-top-[3.75rem] sm:h-40 sm:w-60 lg:-left-12 lg:-top-[3.25rem] lg:h-[8.75rem] lg:w-[13.125rem]"
            />
          </span>
        </Link>

        <div className="order-3 col-span-2 flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm text-[color:var(--text-muted)] lg:order-none lg:col-span-1">
          {links.map((link) => (
            <Link
              className="rounded-full px-4 py-2 transition-all duration-300 hover:bg-white/10 hover:text-[color:var(--text)]"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-self-end gap-2">
          <Link
            aria-label={t("switchLanguage", {language: t(`languages.${nextLocale}`)})}
            className="group inline-flex h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 text-xs font-bold text-[color:var(--text)] transition-all duration-300 hover:border-[color:var(--primary)]/55 hover:bg-[color:var(--primary)]/10 hover:text-[color:var(--primary-light)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--primary)]"
            href={pathname}
            locale={nextLocale}
          >
            <Languages aria-hidden="true" className="size-4" />
            <span>{nextLocale === "ar" ? "العربية" : "EN"}</span>
          </Link>
          <Link
            className="group relative grid size-11 place-items-center rounded-full border border-[color:var(--primary)]/35 bg-[color:var(--primary)]/10 text-[color:var(--primary-light)] shadow-[0_10px_30px_rgba(255,122,0,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--primary)]/60 hover:bg-[color:var(--primary)] hover:text-[color:var(--background)] hover:shadow-[0_14px_38px_rgba(255,122,0,0.38)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--primary)]"
            href={routes.cart}
            aria-label={t("viewCart")}
          >
            <ShoppingCart aria-hidden="true" className="size-5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" strokeWidth={2.2} />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-[color:var(--background)] bg-[color:var(--primary)] transition-colors group-hover:bg-white" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
