import Image from "next/image";
import { useLocale } from "next-intl";
import {
  ArrowRight,
  Camera,
  Clock,
  Mail,
  MapPin,
  Phone,
  ThumbsUp,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";
import { publicMoney, safePublicImage } from "@/lib/public-menu-presentation";

const quickLinks = [
  { label: "Home", href: routes.home },
  { label: "Menu", href: routes.menu },
  { label: "About", href: routes.about },
  { label: "Contact", href: `${routes.home}#contact` },
];


const particles = [
  "left-[8%] top-[18%] size-1",
  "left-[24%] bottom-[18%] size-1.5",
  "right-[12%] top-[24%] size-1",
  "right-[30%] bottom-[16%] size-1",
  "left-[52%] top-[10%] size-1.5",
  "right-[46%] bottom-[32%] size-1",
];

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
  const { restaurant, href } = useStorefront();
  const displayedRestaurantInfo = [
    restaurant.phone && { label: isArabic ? "الهاتف" : "Phone", value: restaurant.phone, href: `tel:${restaurant.phone.replace(/[^+\d]/g, "")}`, icon: Phone },
    restaurant.contactEmail && { label: isArabic ? "البريد الإلكتروني" : "Email", value: restaurant.contactEmail, href: `mailto:${restaurant.contactEmail}`, icon: Mail },
    restaurant.address && { label: isArabic ? "العنوان" : "Location", value: restaurant.address, icon: MapPin },
    restaurant.openingHours && { label: isArabic ? "ساعات العمل" : "Opening Hours", value: restaurant.openingHours, icon: Clock },
  ].filter(Boolean);
  const socialLinks = [
    { label: "Instagram", href: restaurant.socialLinks.instagram, icon: Camera },
    { label: "Facebook", href: restaurant.socialLinks.facebook, icon: ThumbsUp },
    { label: "WhatsApp", href: restaurant.socialLinks.whatsapp, icon: Phone },
  ].filter((social) => {
    const safe = safePublicImage(social.href);
    return safe && safe.startsWith("http");
  });
  return (
    <footer className="relative isolate overflow-hidden bg-[color:var(--background)] px-4 pt-20 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-20 bg-[image:var(--footer-background)]" />
      <div
        className="absolute right-[-18rem] top-8 -z-10 size-[42rem] rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.22),rgba(255,122,0,0.08)_40%,transparent_72%)] blur-3xl"
      />
      <div
        className="absolute bottom-[-18rem] left-[-14rem] -z-10 size-[38rem] rounded-full bg-[radial-gradient(circle,rgba(212,160,23,0.14),rgba(255,122,0,0.08)_42%,transparent_72%)] blur-3xl"
      />
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[color:var(--primary)]/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 top-24 -z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent sm:inset-x-20" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 hidden w-px bg-gradient-to-b from-transparent via-[color:var(--primary)]/16 to-transparent lg:block" />

      {particles.map((className) => (
        <span
          className={`absolute rounded-full bg-[color:var(--primary-light)]/45 shadow-[0_0_18px_rgba(255,157,51,0.58)] ${className}`}
          key={className}
        />
      ))}

      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-8 flex w-fit items-center gap-4 rounded-full border border-[color:var(--primary)]/25 bg-[color:var(--primary)]/10 px-4 py-2 text-xs font-semibold tracking-[0.28em] text-[color:var(--primary-light)] uppercase shadow-[0_0_34px_rgba(255,122,0,0.13)] backdrop-blur-xl">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[color:var(--primary)]/80" />
          {restaurant.name}
          <span className="size-1.5 rounded-full bg-[color:var(--primary-light)] shadow-[0_0_14px_rgba(255,157,51,0.9)]" />
        </div>

        <div className="relative mb-16 overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.035)_54%,rgba(255,122,0,0.07))] p-6 shadow-[0_34px_110px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(255,255,255,0.12),transparent_25%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_38%,rgba(255,122,0,0.12))]" />
          <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[color:var(--primary)]/22 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="relative grid items-center gap-7 lg:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-3xl font-semibold leading-tight text-balance text-[color:var(--text)] sm:text-4xl lg:text-5xl">
                {isArabic ? "اكتشف قائمة" : "Explore the Menu at"} {restaurant.name}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">
                {restaurant.description || (isArabic ? "تصفح الأطباق المتاحة حاليًا." : "Browse the currently available dishes.")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <div>
                <Link
                  className="group inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-7 text-sm font-bold text-[color:var(--background)] shadow-[0_20px_56px_rgba(255,122,0,0.36)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(255,122,0,0.5)] sm:w-auto"
                  href={href(routes.about)}
                >
                  {isArabic ? "عن المطعم" : "About Restaurant"}
                  <ArrowRight
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                    size={18}
                  />
                </Link>
              </div>
              <div>
                <Link
                  className="inline-flex min-h-13 w-full items-center justify-center rounded-full border border-white/14 bg-white/[0.045] px-7 text-sm font-bold text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--primary)]/55 hover:bg-white/[0.08] hover:text-[color:var(--primary-light)] sm:w-auto"
                  href={href(routes.menu)}
                >
                  {isArabic ? "عرض القائمة" : "View Menu"}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div
          className="grid gap-10 border-y border-white/10 py-12 sm:grid-cols-2 lg:grid-cols-[1.24fr_0.76fr_1fr_1.06fr] lg:gap-9 lg:py-14"
        >
          <div>
            <Link className="group inline-flex items-center" href={href(routes.home)} aria-label={restaurant.name}>
              <span className="relative block h-14 w-40 overflow-hidden">
                <Image
                  alt=""
                  className="absolute -left-12 -top-[3.25rem] h-[8.75rem] w-[13.125rem] max-w-none object-contain transition-transform duration-300 group-hover:scale-105"
                  height={1024}
                  sizes="160px"
                  src="/headIcon.webp"
                  width={1536}
                />
              </span>
            </Link>
            <h2 className="mt-5 text-2xl font-semibold tracking-[0.22em] text-[color:var(--text)]">
              {restaurant.branding.brandName || restaurant.name}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[color:var(--text-muted)]">
              {restaurant.description || (isArabic ? "معلومات المطعم وقائمته." : "Restaurant information and menu.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;

                return (
                  <a
                    aria-label={social.label}
                    className="group flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[color:var(--text-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur transition-all duration-300 hover:border-[color:var(--primary)]/55 hover:bg-[color:var(--primary)]/12 hover:text-[color:var(--primary-light)] hover:shadow-[0_0_34px_rgba(255,122,0,0.24)]"
                    href={social.href}
                    key={social.label}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <FooterHeading>{isArabic ? "روابط سريعة" : "Quick Links"}</FooterHeading>
            <nav className="mt-6 grid gap-3">
              {quickLinks.map((link) => (
                <PremiumLink href={href(link.href)} key={link.label}>
                  {isArabic ? ({Home: "الرئيسية", Menu: "القائمة", About: "من نحن", Contact: "تواصل معنا"})[link.label] : link.label}
                </PremiumLink>
              ))}
            </nav>
          </div>

          <div>
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
          </div>

          <div>
            <FooterHeading>{isArabic ? "معلومات الطلب" : "Ordering Information"}</FooterHeading>
            <p className="mt-6 text-sm leading-7 text-[color:var(--text-muted)]">
              {restaurant.deliverySettings.deliveryAvailable ? (isArabic ? "التوصيل متاح." : "Delivery is available.") : (isArabic ? "التوصيل غير متاح حاليًا." : "Delivery is currently unavailable.")}
            </p>
            <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-5 text-sm leading-7 text-[color:var(--text-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
              {restaurant.deliverySettings.deliveryFee !== null && <p>{isArabic ? "رسوم التوصيل" : "Delivery fee"}: {publicMoney(restaurant.deliverySettings.deliveryFee, restaurant.currency, isArabic ? "ar" : "en")}</p>}
              {restaurant.deliverySettings.minimumOrder !== null && <p>{isArabic ? "الحد الأدنى للطلب" : "Minimum order"}: {publicMoney(restaurant.deliverySettings.minimumOrder, restaurant.currency, isArabic ? "ar" : "en")}</p>}
              {restaurant.deliverySettings.estimatedDeliveryTime && <p>{isArabic ? "الوقت التقديري" : "Estimated delivery"}: {restaurant.deliverySettings.estimatedDeliveryTime}</p>}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 py-7 text-sm text-[color:var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {restaurant.name}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="transition-colors duration-300 hover:text-[color:var(--primary-light)]"
              href={href(routes.home)}
            >
              {isArabic ? "الرئيسية" : "Home"}
            </Link>
            <span className="h-4 w-px bg-white/14" />
            <Link
              className="transition-colors duration-300 hover:text-[color:var(--primary-light)]"
              href={href(routes.menu)}
            >
              {isArabic ? "القائمة" : "Menu"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
