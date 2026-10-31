import { useLocale } from "next-intl";
export default function NotFound() {
  const ar = useLocale() === "ar";
  return <main className="flex min-h-[70vh] flex-col items-center justify-center bg-[color:var(--background)] px-6 text-center text-[color:var(--text)]">
    <h1 className="text-4xl font-semibold">{ar ? "المطعم أو الطبق غير متاح" : "Restaurant or dish unavailable"}</h1>
    <p className="mt-4 max-w-lg text-[color:var(--text-muted)]">{ar ? "قد يكون الرابط غير صحيح، أو العنصر لم يعد متاحًا." : "This link may be incorrect, or the item may no longer be available."}</p>
  </main>;
}
