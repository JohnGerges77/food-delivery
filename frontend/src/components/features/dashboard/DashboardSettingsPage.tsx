"use client";

import { CheckCircle2, ImageIcon, LoaderCircle, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/services/api-client";
import { listOwnerProducts, type OwnerProduct } from "@/services/owner-products-service";
import { allOwnerCategories } from "@/services/owner-categories-service";
import { safePublicImage } from "@/lib/public-menu-presentation";
import { PublicProductImage } from "@/components/features/storefront/PublicProductImage";
import { getOwnerRestaurant, patchOwnerRestaurant, restaurantToForm, settingsPatch, validateSettingsForm,
  type OwnerRestaurant, type RestaurantSettingsForm } from "@/services/owner-restaurant-service";
import { useAuthStore } from "@/store/auth-store";
import { ActionButton, DashboardCard, DashboardPageHeader, inputClass, textareaClass } from "./DashboardUI";

type Key = Exclude<keyof RestaurantSettingsForm, "deliveryAvailable">;
type Errors = Partial<Record<keyof RestaurantSettingsForm, string>>;
const profile: [Key, string, string?][] = [
  ["name", "Restaurant Name"], ["phone", "Phone", "tel"], ["contactEmail", "Email", "email"],
  ["address", "Address"], ["logoUrl", "Logo URL", "url"], ["description", "Description", "textarea"],
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
      <label htmlFor={id} className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">{label}</label>
      {type === "textarea" ? <textarea {...props} className={textareaClass} /> : <input {...props} className={inputClass} type={type} inputMode={key === "deliveryFee" || key === "minimumOrder" ? "decimal" : undefined} />}
      {errors[key] ? <p id={`error-${key}`} className="mt-2 text-sm text-red-300">{errors[key]}</p> : null}
    </div>;
  }

  return <section>
    <DashboardPageHeader eyebrow="Restaurant Control" title="Settings"
      description="Maintain your restaurant profile, delivery rules, hours, social links, and appearance."
      action={saved ? <div role="status" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-5 text-sm font-semibold text-emerald-200"><CheckCircle2 aria-hidden="true" size={16} />Settings saved</div> : null} />
    {loading ? <div role="status" aria-label="Loading restaurant settings" className="grid animate-pulse gap-6 xl:grid-cols-[1fr_0.85fr]">
      {[8, 4].map((count) => <DashboardCard className="p-6" key={count}><div className="h-7 w-48 rounded bg-white/10" /><div className="mt-6 grid gap-4 sm:grid-cols-2">{Array.from({ length: count }, (_, index) => <div className="h-16 rounded-xl bg-white/[0.06]" key={index} />)}</div></DashboardCard>)}
    </div> : !form || !restaurant ? <DashboardCard className="p-6"><p role="alert" className="text-red-200">{error}</p><ActionButton className="mt-5" onClick={() => { setLoading(true); setError(""); setReload((value) => value + 1); }}>Retry</ActionButton></DashboardCard> :
    <form noValidate onSubmit={(event) => void save(event)} className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
      <div className="grid gap-6">
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">Restaurant Profile</h3><div className="mt-5 grid gap-4 sm:grid-cols-2">{profile.map(([key, label, type]) => field(key, label, type))}</div><p className="mt-5 text-sm text-[color:var(--text-muted)]">Storefront slug: <span className="text-[color:var(--text)]">{restaurant.slug}</span> · Currency: <span className="text-[color:var(--text)]">{restaurant.currency}</span></p></DashboardCard>
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">Opening Hours</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">Display text for your storefront.</p><div className="mt-5">{field("openingHours", "Opening Hours")}</div></DashboardCard>
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">Social Links</h3><div className="mt-5 grid gap-4 sm:grid-cols-3">{social.map(([key, label, type]) => field(key, label, type))}</div></DashboardCard>
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">Hero Product</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">Choose an available product for your storefront Hero. Its own image appears when available.</p>
          <label htmlFor="settings-hero-product" className="mt-5 block text-sm font-semibold">Featured Hero product</label>
          <select id="settings-hero-product" className={`${inputClass} mt-2`} value={form.heroProductId} disabled={saving} onChange={(event) => change("heroProductId", event.target.value)}>
            <option value="">Automatic selection / graphic fallback</option>
            {form.heroProductId && !eligibleHeroProducts.some((item) => item.id === form.heroProductId) && <option value={form.heroProductId}>Previously selected product (unavailable or not loaded)</option>}
            {eligibleHeroProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {errors.heroProductId && <p role="alert" className="mt-2 text-sm text-red-300">{errors.heroProductId}</p>}
          {heroError && <p role="alert" className="mt-3 text-sm text-red-300">{heroError} <button type="button" className="underline" onClick={() => setReload((value) => value + 1)}>Retry</button></p>}
          {heroHasNext && <button type="button" className="mt-3 min-h-11 text-sm font-semibold text-[color:var(--primary-light)] underline" onClick={() => setHeroPage((page) => page + 1)}>Load more products</button>}
          {(() => { const product = eligibleHeroProducts.find((item) => item.id === form.heroProductId); const image = product && safePublicImage(product.imageUrl || product.images[0]); return product ? <div className="mt-5 flex items-center gap-4 rounded-xl border border-white/10 p-3"><div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-white/5">{image ? <PublicProductImage src={image} alt={product.name} className="object-cover" sizes="80px" /> : <ImageIcon aria-hidden="true" className="m-auto mt-6" />}</div><div><strong>{product.name}</strong><p className="text-sm text-[color:var(--text-muted)]">{image ? "Image preview" : "No image; storefront graphic will appear"}</p></div></div> : null; })()}
        </DashboardCard>
      </div>
      <div className="grid content-start gap-6">
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">Delivery Settings</h3><div className="mt-5 grid gap-4">
          {field("deliveryFee", `Delivery Fee (${restaurant.currency})`)}{field("minimumOrder", `Minimum Order (${restaurant.currency})`)}{field("estimatedDeliveryTime", "Estimated Delivery Time")}
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span><span className="block font-semibold">Delivery Available</span><span className="text-sm text-[color:var(--text-muted)]">Allow delivery orders.</span></span><input type="checkbox" checked={form.deliveryAvailable} disabled={saving} onChange={(event) => change("deliveryAvailable", event.target.checked)} className="size-5 accent-[color:var(--primary)]" /></label>
        </div></DashboardCard>
        <DashboardCard className="p-5 sm:p-6"><h3 className="text-2xl font-semibold">Appearance</h3><div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center"><div className="mx-auto flex size-20 items-center justify-center rounded-3xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]"><ImageIcon aria-hidden="true" size={30} /></div><div className="mt-4 text-2xl font-semibold tracking-[0.16em]">{form.brandName || restaurant.name}</div><p className="mt-2 text-sm text-[color:var(--text-muted)]">Brand preview</p></div><div className="mt-5 grid gap-4">{field("brandName", "Brand Name")}{field("primaryColor", "Primary Color (hex)")}<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span className="size-10 rounded-full border border-white/20" style={{ backgroundColor: /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(form.primaryColor) ? form.primaryColor : "var(--primary)" }} /><span className="text-sm text-[color:var(--text-muted)]">Color preview</span></div></div></DashboardCard>
        {error ? <p role="alert" className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
        <ActionButton className="min-h-14 w-full" disabled={!dirty || saving} type="submit">{saving ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <Save aria-hidden="true" size={17} />}{saving ? "Saving…" : "Save Settings"}</ActionButton>
        {dirty ? <p className="text-center text-sm text-amber-200">You have unsaved changes.</p> : null}
      </div>
    </form>}
  </section>;
}
