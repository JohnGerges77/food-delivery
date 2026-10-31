import { useLocale } from "next-intl";
import { Clock, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";

const particleClasses = [
  "left-[7%] top-[18%] size-1.5",
  "left-[22%] bottom-[18%] size-1",
  "right-[9%] top-[24%] size-1.5",
  "right-[22%] bottom-[24%] size-1",
  "left-[48%] top-[11%] size-1",
  "right-[42%] bottom-[12%] size-1.5",
  "left-[58%] top-[38%] size-1",
  "left-[13%] bottom-[34%] size-1",
];


function ContactCard({ card }) {
  const Icon = card.icon;
  const content = (
    <>
      <div className="absolute -right-20 top-1/2 size-44 -translate-y-1/2 rounded-full bg-[color:var(--primary)]/0 blur-3xl transition-all duration-700 group-hover:bg-[color:var(--primary)]/22" />
      <div className="absolute -left-16 -top-20 size-36 rounded-full bg-white/0 blur-2xl transition-colors duration-700 group-hover:bg-white/[0.035]" />
      <div className="absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent opacity-80" />
      <div className="absolute inset-y-5 left-0 w-px bg-gradient-to-b from-transparent via-[color:var(--primary)]/0 to-transparent transition-colors duration-500 group-hover:via-[color:var(--primary)]/70" />
      <div className="flex size-14 shrink-0 items-center justify-center rounded-[1.15rem] border border-[color:var(--primary)]/28 bg-[linear-gradient(145deg,rgba(255,122,0,0.16),rgba(255,157,51,0.055))] text-[color:var(--primary-light)] shadow-[0_0_32px_rgba(255,122,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-500 group-hover:scale-105 group-hover:border-[color:var(--primary)]/70 group-hover:bg-[color:var(--primary)]/18 group-hover:shadow-[0_0_42px_rgba(255,122,0,0.32),inset_0_1px_0_rgba(255,255,255,0.12)]">
        <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-[0.24em] text-[color:var(--gold)] uppercase transition-colors duration-300 group-hover:text-[color:var(--primary-light)]">
          {card.title}
        </h3>
        <p className="mt-2 whitespace-pre-line text-base leading-7 text-[color:var(--text)]/95">
          {card.value}
        </p>
      </div>
    </>
  );
  const contentClassName = "relative z-20 flex items-start gap-5";

  return (
    <article className="group relative flex min-h-36 items-start gap-5 overflow-hidden rounded-[1.65rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.075),rgba(255,255,255,0.028)_58%,rgba(255,122,0,0.035))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-[color:var(--primary)]/55 hover:bg-white/[0.075] hover:shadow-[0_32px_92px_rgba(255,122,0,0.18),inset_0_1px_0_rgba(255,255,255,0.09)] sm:p-6 lg:p-7">
      {card.href ? (
        <a className={contentClassName} href={card.href} aria-label={`${card.title}: ${card.value}`}>
          {content}
        </a>
      ) : null}
      {!card.href ? <div className={contentClassName}>{content}</div> : null}
    </article>
  );
}

export default function ContactSection() {
  const isArabic = useLocale() === "ar";
  const { restaurant, href } = useStorefront();
  const contactCards = [
    restaurant.phone && { icon: Phone, title: isArabic ? "الهاتف" : "Phone", value: restaurant.phone, href: `tel:${restaurant.phone.replace(/[^+\d]/g, "")}` },
    restaurant.contactEmail && { icon: Mail, title: isArabic ? "البريد الإلكتروني" : "Email", value: restaurant.contactEmail, href: `mailto:${restaurant.contactEmail}` },
    restaurant.address && { icon: MapPin, title: isArabic ? "العنوان" : "Location", value: restaurant.address },
    restaurant.openingHours && { icon: Clock, title: isArabic ? "ساعات العمل" : "Opening Hours", value: restaurant.openingHours },
  ].filter(Boolean);
  return (
    <section id="contact" className="relative isolate overflow-hidden bg-[color:var(--background)] px-4 py-24 text-[color:var(--text)] sm:px-6 sm:py-30 lg:px-8 lg:py-32">
      <div
        className="absolute right-[-20rem] top-10 -z-10 size-[50rem] rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.26),rgba(255,122,0,0.1)_36%,transparent_70%)] blur-3xl"
      />
      <div
        className="absolute bottom-[-21rem] left-[-18rem] -z-10 size-[46rem] rounded-full bg-[radial-gradient(circle,rgba(212,160,23,0.16),rgba(255,122,0,0.08)_42%,transparent_72%)] blur-3xl"
      />
      <div
        className="absolute left-1/2 top-[14%] -z-10 h-[34rem] w-[72rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(255,157,51,0.08),transparent_68%)] blur-2xl"
      />
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_10%,rgba(255,157,51,0.11),transparent_33%),radial-gradient(circle_at_14%_72%,rgba(255,122,0,0.08),transparent_28%),linear-gradient(180deg,rgba(13,13,13,1),rgba(31,31,31,0.55)_48%,rgba(13,13,13,1))]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[color:var(--primary)]/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 hidden h-full w-px bg-gradient-to-b from-transparent via-[color:var(--primary)]/18 to-transparent lg:block" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(115deg,transparent_0%,transparent_43%,rgba(255,122,0,0.08)_44%,transparent_46%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-x-6 top-24 -z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent sm:inset-x-16" />
      <div className="pointer-events-none absolute inset-x-10 bottom-24 -z-10 h-px bg-gradient-to-r from-transparent via-[color:var(--gold)]/18 to-transparent sm:inset-x-24" />

      {particleClasses.map((className) => (
        <span
          className={`absolute rounded-full bg-[color:var(--primary-light)]/45 shadow-[0_0_20px_rgba(255,157,51,0.55)] ${className}`}
          key={className}
        />
      ))}

      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-7 inline-flex items-center gap-4 rounded-full border border-[color:var(--primary)]/35 bg-[linear-gradient(135deg,rgba(255,122,0,0.16),rgba(255,255,255,0.035))] px-4 py-2 text-xs font-semibold tracking-[0.26em] text-[color:var(--primary-light)] uppercase shadow-[0_0_38px_rgba(255,122,0,0.16),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-[color:var(--primary)]/80" />
            {isArabic ? "تواصل معنا" : "Get In Touch"}
            <span className="size-1.5 rounded-full bg-[color:var(--primary-light)] shadow-[0_0_14px_rgba(255,157,51,0.9)]" />
          </div>
          <h2 className="text-4xl font-semibold leading-[1.02] text-balance text-[color:var(--text)] sm:text-5xl lg:text-6xl">
            {isArabic ? "تواصل مع" : "Get in Touch with"}
            <span className="block">
              <span className="text-[color:var(--primary)] drop-shadow-[0_0_30px_rgba(255,122,0,0.22)]">
                {restaurant.name}
              </span>
            </span>
          </h2>
          <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">
            {isArabic ? "معلومات التواصل العامة التي قدمها المطعم." : "Public contact details provided by the restaurant."}
          </p>
        </div>

        <div className="mt-16 grid items-start gap-8 sm:mt-18 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div
            className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-1"
          >
            {contactCards.map((card) => (
              <ContactCard card={card} key={card.title} />
            ))}
            {contactCards.length === 0 && <div className="rounded-[1.65rem] border border-white/10 bg-white/[0.035] p-7 text-[color:var(--text-muted)]">{isArabic ? "لم يُضف المطعم بيانات تواصل بعد." : "Contact details have not been listed yet."}</div>}
          </div>

          <div
            className="relative"
          >
            <div
              className="absolute -inset-10 -z-10 rounded-[3.5rem] bg-[radial-gradient(circle,rgba(255,157,51,0.28),rgba(255,122,0,0.1)_38%,transparent_72%)] blur-2xl"
            />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.035)_50%,rgba(255,122,0,0.055))] p-5 shadow-[0_38px_110px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-2xl sm:p-7 lg:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_0%,rgba(255,255,255,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.09),transparent_36%,rgba(255,122,0,0.11))]" />
              <div className="pointer-events-none absolute -right-24 -top-24 size-60 rounded-full bg-[color:var(--primary)]/20 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="relative">
                <div className="mb-8 rounded-[1.45rem] border border-[color:var(--gold)]/24 bg-[linear-gradient(135deg,rgba(13,13,13,0.68),rgba(31,31,31,0.48))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_66px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--primary)]/35 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)] shadow-[0_0_30px_rgba(255,122,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <Sparkles aria-hidden="true" size={19} strokeWidth={1.8} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold tracking-[0.24em] text-[color:var(--gold)] uppercase">
                        {restaurant.name}
                      </div>
                      <p className="mt-2.5 text-sm leading-7 text-[color:var(--text-muted)]">
                        {restaurant.description || (isArabic ? "استكشف القائمة والمعلومات المتاحة عن المطعم." : "Explore the menu and available restaurant information.")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5">
                  <p className="text-lg leading-8 text-[color:var(--text-muted)]">{isArabic ? "يمكنك تصفح الأطباق المتاحة أو استخدام بيانات التواصل المعروضة." : "Browse available dishes or use the contact details shown here."}</p>
                  <Link className="group relative mt-3 inline-flex min-h-15 items-center justify-center gap-3 overflow-hidden rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] px-8 text-sm font-bold tracking-wide text-[color:var(--background)] shadow-[0_22px_62px_rgba(255,122,0,0.38)] transition-all duration-300 hover:-translate-y-1" href={href("/menu")}>{isArabic ? "عرض القائمة" : "View Menu"}</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
