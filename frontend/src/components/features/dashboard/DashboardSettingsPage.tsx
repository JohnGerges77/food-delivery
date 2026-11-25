"use client";

import { ownerText } from "./owner-copy";

import { CheckCircle2, ImageIcon, LoaderCircle, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { ApiError } from "@/services/api-client";
import { listOwnerProducts, type OwnerProduct } from "@/services/owner-products-service";
import { allOwnerCategories } from "@/services/owner-categories-service";
import { safePublicImage } from "@/lib/public-menu-presentation";
import { PublicProductImage } from "@/components/features/storefront/PublicProductImage";
import { getOwnerRestaurant, patchOwnerRestaurant, restaurantToForm, settingsPatch, validateSettingsForm,
  type OwnerRestaurant, type RestaurantSettingsForm } from "@/services/owner-restaurant-service";
import { useAuthStore } from "@/store/auth-store";
import { ActionButton, DashboardCard, DashboardPageHeader, inputClass, textareaClass } from "./DashboardUI";
import { OwnerImageUpload } from "./OwnerImageUpload";

type Key = Exclude<keyof RestaurantSettingsForm, "deliveryAvailable" | "whatsappOrderingEnabled">;
type Errors = Partial<Record<keyof RestaurantSettingsForm, string>>;
const profile: [Key, string, string?][] = [
  ["name", "Restaurant Name"], ["phone", "Phone", "tel"], ["contactEmail", "Email", "email"],
  ["address", "Address"], ["logoUrl", "Logo URL"], ["description", "Description", "textarea"],
];
const social: [Key, string, string?][] = [["facebook", "Facebook", "url"], ["instagram", "Instagram", "url"], ["whatsapp", "WhatsApp phone or wa.me URL", "text"]];

function message(error: unknown, action: "load" | "save") {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Request rejected. Check the trusted Origin and CSRF configuration, then retry.";
    if (error.status === 400) return "The server rejected these values. Review the fields and retry.";
    if (error.status === 404) return "Restaurant settings are unavailable for this owner.";
  }
  return action === "load" ? "Could not load restaurant settings. Check your connection and retry." :
    "Could not confirm the save. Retry or reload to check current settings.";
}

export function DashboardSettingsPage() {
  const ownerId = useAuthStore((state) => state.context?.restaurant.id);
  return <RestaurantSettingsEditor key={ownerId} ownerId={ownerId} />;
}

function RestaurantSettingsEditor({ ownerId }: { ownerId: string | undefined }) {
  const ar = useLocale() === "ar";
  const labels: Record<string, string> = { "Image URL": "رابط الصورة", "Restaurant Name": "اسم المطعم", Phone: "رقم الهاتف", Email: "البريد الإلكتروني", Address: "العنوان", "Logo URL": "رابط الشعار", Description: "الوصف", "WhatsApp phone or wa.me URL": "رقم واتساب أو رابط wa.me", "Opening Hours": "ساعات العمل", "Estimated Delivery Time": "وقت التوصيل المتوقع", "Brand Name": "اسم العلامة", "Primary Color (hex)": "اللون الأساسي (hex)" };
  const restore = useAuthStore((state) => state.restore);
  const syncRestaurant = useAuthStore((state) => state.updateRestaurantSummary);
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [form, setForm] = useState<RestaurantSettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [reload, setReload] = useState(0);
  const [heroProducts, setHeroProducts] = useState<OwnerProduct[]>([]);
  const [heroPage, setHeroPage] = useState(1);
  const [heroHasNext, setHeroHasNext] = useState(false);
  const [heroError, setHeroError] = useState("");
  const [activeHeroCategories, setActiveHeroCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    void allOwnerCategories().then((categories) => {
      if (!cancelled) setActiveHeroCategories(new Set(categories.filter((item) => item.isActive).map((item) => item.id)));
    }).catch(() => { if (!cancelled) setHeroError("Could not load eligible categories. Retry to choose a Hero product."); });
    return () => { cancelled = true; };
  }, [ownerId, reload]);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    void listOwnerProducts({ page: heroPage, limit: 100, isAvailable: true, sort: "name" }).then((result) => {
      if (cancelled) return;
      setHeroProducts((current) => heroPage === 1 ? result.products : [...current, ...result.products]);
      setHeroHasNext(result.pagination.hasNext);
      setHeroError("");
    }).catch(() => { if (!cancelled) setHeroError("Could not load products. Retry to choose a Hero product."); });
    return () => { cancelled = true; };
  }, [ownerId, heroPage, reload]);

  useEffect(() => {
    let cancelled = false;
    if (!ownerId) return;
    void getOwnerRestaurant().then((result) => {
      if (cancelled) return;
      if (result.id !== ownerId) throw new ApiError(null, "Restaurant identity mismatch");
      setRestaurant(result);
      setForm(restaurantToForm(result));
      setLoading(false);
    }).catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ApiError && cause.status === 401) { void restore(); return; }
      setError(message(cause, "load"));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [ownerId, reload, restore]);

  let dirty = false;
  const eligibleHeroProducts = heroProducts.filter((item) => activeHeroCategories.has(item.categoryId));
  if (restaurant && form) {
    try { dirty = Object.keys(settingsPatch(form, restaurant)).length > 0; }
    catch { dirty = true; }
  }
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change<K extends keyof RestaurantSettingsForm>(key: K, value: RestaurantSettingsForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSaved(false);
    setError("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !restaurant || saving) return;
    const validation = validateSettingsForm(form, restaurant);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const patch = settingsPatch(form, restaurant);
    if (!Object.keys(patch).length) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const result = await patchOwnerRestaurant(patch);
      if (result.id !== ownerId || result.id !== restaurant.id) throw new ApiError(null, "Restaurant identity mismatch");
      setRestaurant(result);
      setForm(restaurantToForm(result));
      syncRestaurant({ id: result.id, name: result.name, slug: result.slug, currency: result.currency });
      setSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) void restore();
      else setError(message(cause, "save"));
    } finally { setSaving(false); }
  }

  function field(key: Key, label: string, type = "text") {
    if (!form) return null;
    const id = `settings-${key}`;
    const props = { id, value: form[key], disabled: saving, "aria-invalid": Boolean(errors[key]),
      "aria-describedby": errors[key] ? `error-${key}` : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(key, event.target.value) };
    return <div key={key} className={key === "description" || key === "logoUrl" ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">{ar ? labels[label] ?? label : label}</label>
      {type === "textarea" ? <textarea {...props} className={textareaClass} /> : <input {...props} className={inputClass} type={type} dir={key === "whatsapp" ? "ltr" : undefined} inputMode={key === "deliveryFee" || key === "minimumOrder" ? "decimal" : undefined} />}
      {errors[key] ? <p id={`error-${key}`} className="mt-2 text-sm text-red-300">{ownerText(ar ? "ar" : "en", errors[key]!)}</p> : null}
    </div>;
  }

  return <section>
    <DashboardPageHeader eyebrow={ar ? "إدارة المطعم" : "Restaurant Control"} title={ar ? "الإعدادات" : "Settings"}
      description={ar ? "إدارة بيانات المطعم والتوصيل وساعات العمل وروابط التواصل والمظهر." : "Maintain your restaurant profile, delivery rules, hours, social links, and appearance."}
      action={saved ? <div role="status" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-5 text-sm font-semibold text-emerald-200"><CheckCircle2 aria-hidden="true" size={16} />{ar ? "تم حفظ الإعدادات" : "Settings saved"}</div> : null} />
    {loading ? <div role="status" aria-label={ownerText((ar ? "ar" : "en"), "Loading restaurant settings")} className="grid animate-pulse gap-6 xl:grid-cols-[1fr_0.85fr]">
      {[8, 4].map((count) => <DashboardCard className="p-6" key={count}><div className="h-7 w-48 rounded bg-white/10" /><div className="mt-6 grid gap-4 sm:grid-cols-2">{Array.from({ length: count }, (_, index) => <div className="h-16 rounded-xl bg-white/[0.06]" key={index} />)}</div></DashboardCard>)}
    </div> : !form || !restaurant ? <DashboardCard className="p-6"><p role="alert" className="text-red-200">{ownerText(ar ? "ar" : "en", error)}</p><ActionButton className="mt-5" onClick={() => { setLoading(true); setError(""); setReload((value) => value + 1); }}>{ownerText((ar ? "ar" : "en"), "Retry")}</ActionButton></DashboardCard> :
    <form noValidate onSubmit={(event) => void save(event)} className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
      <div className="grid gap-6">
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">{ar ? "صورة عن المطعم" : "About Restaurant Image"}</h3><div className="mt-5">{field("aboutImageUrl", "Image URL", "url")}</div>{safePublicImage(form.aboutImageUrl) && <div className="relative mt-4 aspect-video max-w-md overflow-hidden rounded-xl"><PublicProductImage src={form.aboutImageUrl} alt={ar ? "معاينة صورة المطعم" : "About image preview"} className="object-cover" /></div>}{form.aboutImageUrl && <button type="button" className="mt-3 min-h-11 text-sm underline" onClick={() => change("aboutImageUrl", "")}>{ar ? "إزالة الصورة" : "Remove image"}</button>}</DashboardCard>
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">{ownerText((ar ? "ar" : "en"), "Restaurant Profile")}</h3><div className="mt-5 grid gap-4 sm:grid-cols-2">{profile.map(([key, label, type]) => field(key, label, type))}</div><div className="mt-5"><OwnerImageUpload target={{ kind: "logo" }} currentUrl={restaurant.logoUrl} onChanged={(url) => { setRestaurant({ ...restaurant, logoUrl: url }); setForm({ ...form, logoUrl: url ?? "" }); setSaved(false); }} /></div><p className="mt-5 text-sm text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "Storefront slug:")}{" "}<span className="text-[color:var(--text)]">{restaurant.slug}</span></p></DashboardCard>
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">{ownerText((ar ? "ar" : "en"), "Opening Hours")}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "Display text for your storefront.")}</p><div className="mt-5">{field("openingHours", ownerText((ar ? "ar" : "en"), "Opening Hours"))}</div></DashboardCard>
        <DashboardCard className="p-5 sm:p-6">
          <h3 className="text-2xl font-semibold">{ownerText((ar ? "ar" : "en"), "Social Links")}</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">{social.map(([key, label, type]) => field(key, label, type))}</div>
          <label className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <span><span className="block font-semibold">{ar ? "تفعيل الطلب عبر واتساب" : "Enable WhatsApp ordering"}</span>
              <span className="text-sm text-[color:var(--text-muted)]">{ar ? "أدخل رقم واتساب مع رمز الدولة. يظل الطلب المباشر متاحًا حسب إعدادات التوصيل." : "Enter a WhatsApp number with its country code. Direct ordering follows your delivery settings."}</span></span>
            <input type="checkbox" checked={form.whatsappOrderingEnabled} disabled={saving}
              onChange={(event) => change("whatsappOrderingEnabled", event.target.checked)} className="size-5 accent-[color:var(--primary)]" />
          </label>
        </DashboardCard>
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">{ownerText((ar ? "ar" : "en"), "Hero Product")}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "Choose an available product for your storefront Hero. Its own image appears when available.")}</p>
          <label htmlFor="settings-hero-product" className="mt-5 block text-sm font-semibold">{ownerText((ar ? "ar" : "en"), "Featured Hero product")}</label>
          <select id="settings-hero-product" className={`${inputClass} mt-2`} value={form.heroProductId} disabled={saving} onChange={(event) => change("heroProductId", event.target.value)}>
            <option value="">{ownerText((ar ? "ar" : "en"), "Automatic selection / graphic fallback")}</option>
            {form.heroProductId && !eligibleHeroProducts.some((item) => item.id === form.heroProductId) && <option value={form.heroProductId}>{ownerText((ar ? "ar" : "en"), "Previously selected product (unavailable or not loaded)")}</option>}
            {eligibleHeroProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {errors.heroProductId && <p role="alert" className="mt-2 text-sm text-red-300">{ownerText(ar ? "ar" : "en", errors.heroProductId)}</p>}
          {heroError && <p role="alert" className="mt-3 text-sm text-red-300">{ownerText(ar ? "ar" : "en", heroError)} <button type="button" className="underline" onClick={() => setReload((value) => value + 1)}>{ownerText((ar ? "ar" : "en"), "Retry")}</button></p>}
          {heroHasNext && <button type="button" className="mt-3 min-h-11 text-sm font-semibold text-[color:var(--primary-light)] underline" onClick={() => setHeroPage((page) => page + 1)}>{ownerText((ar ? "ar" : "en"), "Load more products")}</button>}
          {(() => { const product = eligibleHeroProducts.find((item) => item.id === form.heroProductId); const image = product && safePublicImage(product.imageUrl || product.images[0]); return product ? <div className="mt-5 flex items-center gap-4 rounded-xl border border-white/10 p-3"><div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-white/5">{image ? <PublicProductImage src={image} alt={product.name} className="object-cover" sizes="80px" /> : <ImageIcon aria-hidden="true" className="m-auto mt-6" />}</div><div><strong>{product.name}</strong><p className="text-sm text-[color:var(--text-muted)]">{image ? ownerText((ar ? "ar" : "en"), "Image preview") : ownerText((ar ? "ar" : "en"), "No image; storefront graphic will appear")}</p></div></div> : null; })()}
        </DashboardCard>
      </div>
      <div className="grid content-start gap-6">
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">{ownerText((ar ? "ar" : "en"), "Delivery Settings")}</h3><div className="mt-5 grid gap-4">
          {field("deliveryFee", ar ? `رسوم التوصيل (${restaurant.currency})` : `Delivery Fee (${restaurant.currency})`)}{field("minimumOrder", ar ? `الحد الأدنى للطلب (${restaurant.currency})` : `Minimum Order (${restaurant.currency})`)}{field("estimatedDeliveryTime", ar ? "وقت التوصيل المتوقع" : "Estimated Delivery Time")}
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span><span className="block font-semibold">{ownerText((ar ? "ar" : "en"), "Delivery Available")}</span><span className="text-sm text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "Allow delivery orders.")}</span></span><input type="checkbox" checked={form.deliveryAvailable} disabled={saving} onChange={(event) => change("deliveryAvailable", event.target.checked)} className="size-5 accent-[color:var(--primary)]" /></label>
        </div></DashboardCard>
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">{ownerText((ar ? "ar" : "en"), "Appearance")}</h3><div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center"><div className="mx-auto flex size-20 items-center justify-center rounded-3xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]"><ImageIcon aria-hidden="true" size={30} /></div><div className="mt-4 text-2xl font-semibold tracking-[0.16em]">{form.brandName || restaurant.name}</div><p className="mt-2 text-sm text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "Brand preview")}</p></div><div className="mt-5 grid gap-4">{field("brandName", ar ? "اسم العلامة" : "Brand Name")}{field("primaryColor", ar ? "اللون الأساسي (hex)" : "Primary Color (hex)")}<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span className="size-10 rounded-full border border-white/20" style={{ backgroundColor: /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(form.primaryColor) ? form.primaryColor : "var(--primary)" }} /><span className="text-sm text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "Color preview")}</span></div></div></DashboardCard>
        {error ? <p role="alert" className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{ownerText(ar ? "ar" : "en", error)}</p> : null}
        <ActionButton className="min-h-14 w-full" disabled={!dirty || saving} type="submit">{saving ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <Save aria-hidden="true" size={17} />}{saving ? (ar ? "جارٍ الحفظ…" : ownerText((ar ? "ar" : "en"), "Saving…")) : (ar ? "حفظ الإعدادات" : "Save Settings")}</ActionButton>
        {dirty ? <p className="text-center text-sm text-amber-200">{ar ? "لديك تغييرات لم تُحفظ." : "You have unsaved changes."}</p> : null}
      </div>
    </form>}
  </section>;
}
