"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Languages, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";
import { PublicProductImage } from "@/components/features/storefront/PublicProductImage";
import { useCartStore } from "@/store/cart-store";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string, hash: string, homeHref: string) {
  if (href.includes("#")) {
    const [path, targetHash] = href.split("#");
    return pathname === path && hash === `#${targetHash}`;
  }

  if (href === homeHref) {
    return (pathname === homeHref || pathname === homeHref.replace(/\/$/, "")) && hash !== "#contact";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicNavbar() {
  const { restaurant, href } = useStorefront();
  const t = useTranslations("navigation");
  const locale = useLocale();
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const nextLocale = locale === "ar" ? "en" : "ar";
  const tenantSlug = useCartStore((state) => state.tenantSlug);
  const cartCount = useCartStore((state) => state.items.reduce((total, item) => total + item.quantity, 0));
  const homeHref = href(routes.home);
  const links = [
    { href: homeHref, label: t("home") },
    { href: href(routes.menu), label: t("menu") },
    { href: href(routes.about), label: t("about") },
    { href: href(`${routes.home}#contact`), label: t("contact") },
  ];
  const cartIsActive = pathname === href(routes.cart) || pathname === href(routes.checkout);

  useEffect(() => {
    function syncHash() {
      setHash(window.location.hash);
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--border)] bg-[color:var(--background)]/75 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-6">
      <div className="mx-auto grid max-w-7xl grid-cols-2 items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
        <Link
          className="group inline-flex w-fit items-center"
          href={homeHref}
          aria-label={restaurant.name}
        >
          <span className="relative block h-12 w-36 overflow-hidden sm:h-14 sm:w-40 lg:h-12 lg:w-36">
            {restaurant.logoUrl ? <PublicProductImage alt={restaurant.name} className="object-contain" src={restaurant.logoUrl} sizes="160px" /> : <Image
              src="/headIcon.webp"
              alt={t("brand")}
              width={1536}
              height={1024}
              sizes="(min-width: 1024px) 144px, 160px"
              className="absolute -left-12 -top-[3.25rem] h-[8.75rem] w-[13.125rem] max-w-none object-contain transition-transform duration-300 group-hover:scale-105 sm:-left-14 sm:-top-[3.75rem] sm:h-40 sm:w-60 lg:-left-12 lg:-top-[3.25rem] lg:h-[8.75rem] lg:w-[13.125rem]"
            />}
          </span>
          <span className="sr-only">{restaurant.name}</span>
        </Link>

        <div className="order-3 col-span-2 flex items-center justify-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--glass)] p-1 text-sm text-[color:var(--text-muted)] lg:order-none lg:col-span-1">
          {links.map((link) => {
            const isActive = isActivePath(pathname, link.href, hash, homeHref);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 transition-all duration-300 hover:bg-[color:var(--glass-strong)] hover:text-[color:var(--text)]",
                  isActive &&
                    "bg-[color:var(--glass-strong)] text-[color:var(--primary-light)] shadow-[0_10px_28px_rgba(255,122,0,0.18)] ring-1 ring-[color:var(--primary)]/35",
                )}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-self-end gap-2">
          <Link
            aria-label={t("switchLanguage", {language: t(`languages.${nextLocale}`)})}
            className="group inline-flex h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--glass)] px-3 text-xs font-bold text-[color:var(--text)] transition-all duration-300 hover:border-[color:var(--primary)]/55 hover:bg-[color:var(--primary)]/10 hover:text-[color:var(--primary-light)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--primary)]"
            href={pathname}
            locale={nextLocale}
          >
            <Languages aria-hidden="true" className="size-4" />
            <span>{nextLocale === "ar" ? "العربية" : "EN"}</span>
          </Link>
          <Link
            aria-current={cartIsActive ? "page" : undefined}
            className={cn(
              "group relative grid size-11 place-items-center rounded-full border border-[color:var(--primary)]/35 bg-[color:var(--primary)]/10 text-[color:var(--primary-light)] shadow-[0_10px_30px_rgba(255,122,0,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--primary)]/60 hover:bg-[color:var(--primary)] hover:text-[color:var(--background)] hover:shadow-[0_14px_38px_rgba(255,122,0,0.38)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--primary)]",
              cartIsActive && "border-[color:var(--primary)]/70 bg-[color:var(--primary)] text-[color:var(--background)] shadow-[0_14px_38px_rgba(255,122,0,0.38)]",
            )}
            href={href(routes.cart)}
            aria-label={t("viewCart")}
          >
            <ShoppingCart aria-hidden="true" className="size-5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" strokeWidth={2.2} />
            {tenantSlug === restaurant.slug && cartCount > 0 ? <span className="absolute -right-1 -top-1 rounded-full bg-[color:var(--primary)] px-1.5 text-xs text-[color:var(--background)]">{cartCount}</span> : null}
          </Link>
        </div>
      </div>
    </nav>
  );
}
