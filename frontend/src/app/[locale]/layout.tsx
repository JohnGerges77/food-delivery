import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import localFont from "next/font/local";
import "lenis/dist/lenis.css";
import { getDirection, isLocale, locales } from "@/i18n/routing";
import { SmoothScrollProvider } from "@/components/common/SmoothScrollProvider";
import "../globals.css";

const tajawal = localFont({
  src: [
    { path: "../../fonts/Tajawal-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/Tajawal-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/Tajawal-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../fonts/Tajawal-ExtraBold.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-tajawal",
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: isLocale(locale) ? locale : "en",
    namespace: "metadata",
  });

  return {
    title: t("title"),
    description: t("description"),
    icons: { icon: { url: "/logo.webp", type: "image/webp" } },
    openGraph: { title: t("title"), description: t("description") },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={getDirection(locale)} data-theme="dark" className={locale === "ar" ? tajawal.variable : undefined} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var theme=localStorage.getItem("savora-theme");document.documentElement.dataset.theme=theme==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
