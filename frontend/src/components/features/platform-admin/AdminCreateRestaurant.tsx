"use client";
import { useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAdminRestaurant, PlatformApiError } from "@/services/platform-admin-service";

export function AdminCreateRestaurant() {
  const locale = useLocale(); const ar = locale === "ar"; const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const restaurant = { name: String(fields.get("name") ?? "").trim(),
      slug: String(fields.get("slug") ?? "").trim().toLowerCase(),
      currency: String(fields.get("currency") ?? "").toUpperCase(),
      storefrontTheme: String(fields.get("storefrontTheme") ?? "savora-classic"),
      description: String(fields.get("description") ?? "").trim() };
    const owner = { name: String(fields.get("ownerName") ?? "").trim(),
      email: String(fields.get("ownerEmail") ?? "").trim().toLowerCase(),
      password: String(fields.get("ownerPassword") ?? "") };
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(restaurant.slug) ||
        owner.password.length < 12 || owner.password.length > 128) {
      setError(ar ? "تحقق من الرابط وكلمة المرور (12 إلى 128 حرفًا)." : "Check the slug and password (12 to 128 characters)."); return;
    }
    setBusy(true); setError("");
    try {
      const result = await createAdminRestaurant({ restaurant: {
        name: restaurant.name, slug: restaurant.slug, currency: restaurant.currency,
        storefrontTheme: restaurant.storefrontTheme === "savora-aqua" || restaurant.storefrontTheme === "savora-cafe" || restaurant.storefrontTheme === "savora-luxury" ? restaurant.storefrontTheme : "savora-classic",
        ...(restaurant.description ? { description: restaurant.description } : {}) }, owner });
      form.reset();
      router.replace(`/${locale}/admin/restaurants/${result.restaurant.id}`);
    } catch (cause) {
      setError(cause instanceof PlatformApiError && cause.status === 409 ?
        (ar ? "الرابط أو بريد المالك مستخدم بالفعل." : "Slug or owner email already exists.") :
        cause instanceof PlatformApiError && cause.status === 400 ?
          (ar ? "تحقق من بيانات المطعم والمالك." : "Check restaurant and owner details.") :
          (ar ? "تعذّر إنشاء المطعم. حاول مرة أخرى." : "Could not create restaurant. Try again."));
    } finally { setBusy(false); }
  }
  const input = "mt-2 w-full rounded-xl border border-white/15 bg-[#0e1118] p-3 outline-none focus:border-orange-400";
  return <div className="max-w-3xl">
    <Link href={`/${locale}/admin/restaurants`} className="text-sm text-orange-300">← {ar ? "المطاعم" : "Restaurants"}</Link>
    <h1 className="mt-4 text-3xl font-extrabold">{ar ? "إضافة مطعم ومالك" : "Create restaurant and owner"}</h1>
    <p className="mt-2 text-sm text-white/55">{ar ? "يتم إنشاء الحسابين معًا. شارك كلمة المرور الأولية مع المالك عبر قناة آمنة." : "Both records are created together. Share the initial password through a secure channel."}</p>
    <form onSubmit={submit} className="mt-7 space-y-7">
      <section className="grid gap-4 rounded-2xl border border-white/10 bg-[#171a22] p-6 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-xl font-bold text-orange-300">{ar ? "المطعم" : "Restaurant"}</h2>
        <label>{ar ? "اسم المطعم" : "Name"}<input className={input} name="name" required maxLength={120} /></label>
        <label>{ar ? "الرابط المختصر" : "Slug"}<input className={input} name="slug" dir="ltr" required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
        <label>{ar ? "العملة" : "Currency"}<select className={input} name="currency"><option value="EGP">EGP</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="SAR">SAR</option><option value="AED">AED</option></select></label>
        <label>{ar ? "تصميم واجهة المطعم" : "Storefront theme"}<select className={input} name="storefrontTheme"><option value="savora-classic">Savora Classic</option><option value="savora-aqua">Savora Aqua</option><option value="savora-cafe">Savora Café</option><option value="savora-luxury">Savora Luxury</option></select></label>
        <label className="sm:col-span-2">{ar ? "الوصف (اختياري)" : "Description (optional)"}<textarea className={input} name="description" maxLength={1000} rows={3} /></label>
      </section>
      <section className="grid gap-4 rounded-2xl border border-white/10 bg-[#171a22] p-6 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-xl font-bold text-orange-300">{ar ? "المالك" : "Owner"}</h2>
        <label>{ar ? "الاسم" : "Name"}<input className={input} name="ownerName" required maxLength={120} /></label>
        <label>{ar ? "البريد الإلكتروني" : "Email"}<input className={input} name="ownerEmail" type="email" dir="ltr" required maxLength={254} autoComplete="off" /></label>
        <label className="sm:col-span-2">{ar ? "كلمة المرور الأولية" : "Initial password"}<input className={input} name="ownerPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      </section>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      <button disabled={busy} className="rounded-xl bg-orange-500 px-6 py-3 font-bold text-black disabled:opacity-50">{busy ? (ar ? "جارٍ الإنشاء…" : "Creating…") : (ar ? "إنشاء المطعم والمالك" : "Create restaurant and owner")}</button>
    </form>
  </div>;
}
