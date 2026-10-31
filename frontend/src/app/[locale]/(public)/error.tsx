"use client";

import { useLocale } from "next-intl";
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ar = useLocale() === "ar";
  return <main className="flex min-h-[70vh] flex-col items-center justify-center bg-[color:var(--background)] px-6 text-center text-[color:var(--text)]">
    <h1 className="text-4xl font-semibold">{ar ? "القائمة غير متاحة الآن" : "The menu is unavailable right now"}</h1>
    <p className="mt-4 text-[color:var(--text-muted)]">{ar ? "تعذّر الوصول إلى المطعم. حاول مرة أخرى." : "We could not reach the restaurant. Please try again."}</p>
    <button className="mt-8 rounded-full bg-[color:var(--primary)] px-8 py-3 font-semibold text-black" onClick={reset} type="button">{ar ? "إعادة المحاولة" : "Retry"}</button>
  </main>;
}
