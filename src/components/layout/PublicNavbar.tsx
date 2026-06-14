import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

export function PublicNavbar() {
  const t = useTranslations("navigation");
  const links = [
    { href: routes.home, label: "Home" },
    { href: routes.menu, label: "Menu" },
    { href: `${routes.home}#about`, label: "About" },
    { href: `${routes.home}#contact`, label: "Contact" },
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

        <Link
          className="justify-self-end rounded-full bg-[color:var(--primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--background)] shadow-[0_12px_34px_rgba(255,122,0,0.34)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[color:var(--primary-light)] hover:shadow-[0_16px_42px_rgba(255,157,51,0.42)]"
          href={routes.menu}
        >
          Order Now
        </Link>
      </div>
    </nav>
  );
}
