import Image from "next/image";
import { useLocale } from "next-intl";
import { ChefHat, Heart, Leaf, UtensilsCrossed } from "lucide-react";

const features = [
  {
    title: "Fresh Ingredients",
    description:
      "We source only high-quality ingredients selected daily for maximum freshness and flavor.",
    icon: Leaf,
  },
  {
    title: "Expert Chefs",
    description:
      "Our experienced chefs combine creativity and precision in every dish we serve.",
    icon: ChefHat,
  },
  {
    title: "Unforgettable Taste",
    description:
      "Bold flavors and carefully balanced recipes create a dining experience worth remembering.",
    icon: UtensilsCrossed,
  },
  {
    title: "Made With Care",
    description:
      "Every plate is prepared with attention, passion, and a commitment to excellence.",
    icon: Heart,
  },
];

export default function WhyChoose() {
  const isArabic = useLocale() === "ar";
  return (
    <section className="relative isolate overflow-hidden bg-[color:var(--background)] px-4 py-24 text-[color:var(--text)] sm:px-6 sm:py-28 lg:px-8">
      <div
        className="absolute left-[-18rem] top-10 -z-10 size-[38rem] rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.18),rgba(255,122,0,0.08)_36%,transparent_70%)] blur-3xl"
      />
      <div
        className="absolute bottom-[-16rem] right-[-12rem] -z-10 size-[40rem] rounded-full bg-[radial-gradient(circle,rgba(212,160,23,0.14),rgba(255,122,0,0.08)_42%,transparent_72%)] blur-3xl"
      />
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[color:var(--primary)]/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[0.96fr_1.04fr] lg:gap-20">
        <div>
          <div
            className="mb-7 inline-flex items-center gap-4 rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 px-4 py-2 text-xs font-semibold tracking-[0.26em] text-[color:var(--primary-light)] uppercase shadow-[0_0_34px_rgba(255,122,0,0.14)] backdrop-blur"
          >
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-[color:var(--primary)]/80" />
            {isArabic ? "لماذا تختار سافورا" : "Why Choose Savora"}
            <span className="size-1.5 rounded-full bg-[color:var(--primary-light)] shadow-[0_0_14px_rgba(255,157,51,0.9)]" />
          </div>

          <div>
            <h2 className="max-w-3xl text-4xl font-semibold leading-[1.02] text-balance text-[color:var(--text)] sm:text-5xl lg:text-6xl">
              {isArabic ? "أكثر من مجرد وجبة،" : "More Than a Meal,"}
              <span className="block text-[color:var(--primary-light)] drop-shadow-[0_0_28px_rgba(255,122,0,0.18)]">
                {isArabic ? "إنها تجربة" : "It's an Experience"}
              </span>
            </h2>
            <p className="mt-7 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-lg">
              {isArabic
                ? "في سافورا لا نقدّم الطعام فحسب، بل نصنع لحظات لا تُنسى بمكونات فاخرة وخبرة وشغف بتجربة استثنائية."
                : "At Savora, we don't just serve food - we craft memorable moments using premium ingredients, expert techniques, and a passion for exceptional dining."}
            </p>
            <div className="mt-8 flex max-w-md items-center gap-4">
              <span className="h-px flex-1 bg-gradient-to-r from-[color:var(--primary)]/70 to-transparent" />
              <span className="text-[0.65rem] font-semibold tracking-[0.24em] text-[color:var(--gold)] uppercase">
                {isArabic ? "معيار سافورا" : "Savora Standard"}
              </span>
            </div>
          </div>

          <div
            className="mt-11 grid gap-4 sm:grid-cols-2 sm:gap-5"
          >
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-5 shadow-[0_18px_56px_rgba(0,0,0,0.28)] backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:border-[color:var(--primary)]/45 hover:bg-white/[0.065] hover:shadow-[0_26px_78px_rgba(255,122,0,0.16)]"
                  key={feature.title}
                >
                  <div className="absolute -right-14 top-2 size-32 rounded-full bg-[color:var(--primary)]/0 blur-2xl transition-colors duration-500 group-hover:bg-[color:var(--primary)]/18" />
                  <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <div className="mb-5 flex size-13 items-center justify-center rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 text-[color:var(--primary-light)] shadow-[0_0_28px_rgba(255,122,0,0.14)] transition-all duration-500 group-hover:border-[color:var(--primary)]/60 group-hover:bg-[color:var(--primary)]/18 group-hover:shadow-[0_0_34px_rgba(255,122,0,0.24)]">
                    <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-lg font-semibold text-[color:var(--text)] transition-colors duration-300 group-hover:text-[color:var(--primary-light)]">
                    {isArabic
                      ? ({"Fresh Ingredients": "مكونات طازجة", "Expert Chefs": "طهاة خبراء", "Unforgettable Taste": "مذاق لا يُنسى", "Made With Care": "محضّر بعناية"})[feature.title]
                      : feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
                    {isArabic
                      ? ({"Fresh Ingredients": "نختار يوميًا مكونات عالية الجودة لأقصى درجات الطزاجة والنكهة.", "Expert Chefs": "يجمع طهاتنا الخبراء بين الإبداع والدقة في كل طبق.", "Unforgettable Taste": "نكهات جريئة ووصفات متوازنة تصنع تجربة تستحق التذكر.", "Made With Care": "يُحضّر كل طبق باهتمام وشغف والتزام بالجودة."})[feature.title]
                      : feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>

        <div
          className="relative lg:pl-2"
        >
          <div
            className="absolute -inset-10 -z-10 rounded-[3.5rem] bg-[radial-gradient(circle,rgba(255,157,51,0.28),rgba(255,122,0,0.09)_44%,transparent_72%)] blur-2xl"
          />
          <div className="absolute -left-4 top-10 z-10 hidden h-24 w-px bg-gradient-to-b from-transparent via-[color:var(--primary)]/60 to-transparent lg:block" />
          <div className="absolute -right-4 -top-4 z-10 hidden rounded-full border border-[color:var(--gold)]/35 bg-[color:var(--background)]/75 px-5 py-2 text-xs font-semibold tracking-[0.22em] text-[color:var(--gold)] uppercase shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur-md sm:block">
            {isArabic ? "يُحضّر يوميًا" : "Crafted Daily"}
          </div>
          <div className="group relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[color:var(--card)]/55 p-2 shadow-[0_34px_100px_rgba(0,0,0,0.44)] transition-transform duration-300 hover:-translate-y-1">
            <div className="pointer-events-none absolute inset-0 rounded-[2.25rem] bg-gradient-to-br from-white/10 via-transparent to-[color:var(--primary)]/10" />
            <div className="relative min-h-[34rem] overflow-hidden rounded-[1.85rem] sm:min-h-[42rem] lg:min-h-[48rem]">
              <Image
                alt="Luxury Savora restaurant dining experience"
                className="object-cover transition-transform duration-700 group-hover:scale-106"
                fill
                sizes="(min-width: 1024px) 48vw, 100vw"
                src="/whyChooseUs.webp"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)]/54 via-transparent to-black/10" />
              <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/10 bg-[color:var(--background)]/58 px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-md">
                <div className="text-[0.65rem] font-semibold tracking-[0.22em] text-[color:var(--primary-light)] uppercase">
                  {isArabic ? "مذاق خاص وذكرى خالدة" : "Private Taste, Public Memory"}
                </div>
                <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                  {isArabic ? "مصمم لأمسيات لا تريد لها أن تنتهي." : "Designed for evenings that linger."}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-7 flex items-center gap-4 text-xs font-semibold tracking-[0.24em] text-[color:var(--gold)] uppercase">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[color:var(--primary)]/50 to-transparent" />
            {isArabic ? "تجربة طعام استثنائية" : "Exceptional Dining"}
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[color:var(--primary)]/50 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
