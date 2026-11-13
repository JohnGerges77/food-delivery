"use client";

import { ownerText, productFeedback, productImageLabel, productImagesTitle } from "./owner-copy";

import { Edit3, ImageIcon, Package, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { ApiError } from "@/services/api-client";
import { deleteOwnerGalleryImage, isManagedImage } from "@/services/owner-media-service";
import { ownerCatalogError, type OwnerPagination } from "@/services/owner-catalog-common";
import { allOwnerCategories, type OwnerCategory } from "@/services/owner-categories-service";
import { createOwnerProduct, currencyDigits, deleteOwnerProduct, formatOwnerPrice, getOwnerProduct,
  listOwnerProducts, patchOwnerProduct, productPatch, productToForm, productWrite, validateProductForm,
  type OwnerProduct, type ProductFormValues, type ProductSort } from "@/services/owner-products-service";
import { useAuthStore } from "@/store/auth-store";
import { CatalogImage } from "./CatalogImage";
import { CatalogToast } from "./CatalogToast";
import { ActionButton, DashboardCard, DashboardModal, DashboardPageHeader, SearchInput, StatusBadge, inputClass, textareaClass } from "./DashboardUI";
import { OwnerImageUpload } from "./OwnerImageUpload";
import { useOwnerMediaAvailability } from "./useOwnerMediaAvailability";

const limit = 12;
type Errors = Partial<Record<keyof ProductFormValues, string>>;
type TextKey = Exclude<keyof ProductFormValues, "isAvailable" | "isFeatured">;

export function DashboardProductsPage() {
  const context = useAuthStore((state) => state.context);
  if (!context) return null;
  return <ProductEditor key={`${context.restaurant.id}:${context.restaurant.currency}`} currency={context.restaurant.currency} />;
}

function ProductEditor({ currency }: { currency: string }) {
  const { available: mediaAvailable } = useOwnerMediaAvailability();
  const locale = useLocale();
  const ar = locale === "ar";
  const restore = useAuthStore((state) => state.restore);
  const [products, setProducts] = useState<OwnerProduct[]>([]);
  const [imageTarget, setImageTarget] = useState<OwnerProduct | null>(null);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const [categories, setCategories] = useState<OwnerCategory[]>([]);
  const [pagination, setPagination] = useState<OwnerPagination | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProductSort>("-createdAt");
  const [categoryId, setCategoryId] = useState("");
  const [available, setAvailable] = useState("all");
  const [featured, setFeatured] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [revision, setRevision] = useState(0);
  const [categoryRevision, setCategoryRevision] = useState(0);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<OwnerProduct | null>(null);
  const [form, setForm] = useState<ProductFormValues>(productToForm());
  const [errors, setErrors] = useState<Errors>({});
  const [modalError, setModalError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OwnerProduct | null>(null);
  const [deleteConflict, setDeleteConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void allOwnerCategories().then((result) => {
      if (cancelled) return;
      setCategories(result); setCategoryLoading(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof ApiError && error.status === 401) { void restore(); return; }
      setCategoryError(ownerText(locale, ownerCatalogError(error, "Could not load categories. Retry to select a real category.")));
      setCategoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [categoryRevision, restore, locale]);

  useEffect(() => {
    let cancelled = false;
    void listOwnerProducts({ page, limit, sort, categoryId: categoryId || undefined,
      isAvailable: available === "all" ? undefined : available === "true",
      isFeatured: featured === "all" ? undefined : featured === "true" }).then((result) => {
      if (cancelled) return;
      if (page > 1 && result.products.length === 0) { setPage(page - 1); return; }
      setProducts(result.products); setPagination(result.pagination); setLoading(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof ApiError && error.status === 401) { void restore(); return; }
      setLoadError(ownerText(locale, ownerCatalogError(error, "Could not load products. Retry when the connection is available.")));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [page, sort, categoryId, available, featured, revision, restore, locale]);

  function refreshProducts() { setLoading(true); setLoadError(""); setRevision((value) => value + 1); }
  function refreshCategories() { setCategoryLoading(true); setCategoryError(""); setCategoryRevision((value) => value + 1); }
  function changeFilter(change: () => void) { setLoading(true); setLoadError(""); setPage(1); change(); }
  function failure(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.status === 401) { void restore(); return ""; }
    if (error instanceof ApiError && error.status === 404) { refreshCategories(); refreshProducts(); }
    return ownerText(locale, ownerCatalogError(error, fallback));
  }

  function openCreate() {
    if (!categories.length) return;
    setForm({ ...productToForm(), categoryId: categories[0].id });
    setEditing(null); setErrors({}); setModalError(""); setMode("create");
  }
  async function openEdit(product: OwnerProduct) {
    if (openingId) return;
    setOpeningId(product.id);
    try {
      const detail = await getOwnerProduct(product.id);
      setEditing(detail); setForm(productToForm(detail)); setErrors({}); setModalError(""); setMode("edit");
    } catch (error) { setActionError(failure(error, ownerText(locale, "Could not open this product. Retry."))); }
    finally { setOpeningId(null); }
  }
  function closeModal() { if (!busy) { setMode(null); setEditing(null); setDeleteTarget(null); setDeleteConflict(false); setModalError(""); } }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const validation = validateProductForm(form, categories, currency);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const patch = editing ? productPatch(form, editing, categories, currency) : null;
    if (patch && !Object.keys(patch).length) { closeModal(); return; }
    setBusy(true); setModalError("");
    try {
      const result = editing ? await patchOwnerProduct(editing.id, patch!) :
        await createOwnerProduct(productWrite(form, categories, currency));
      setFeedback(productFeedback(locale, result.name, editing ? "updated" : "created")); setActionError("");
      setMode(null); setEditing(null);
      if (!editing) setPage(1);
      refreshProducts();
    } catch (error) { setModalError(failure(error, ownerText(locale, "Could not confirm the save. Retry or refresh to check current data."))); }
    finally { setBusy(false); }
  }

  async function toggle(product: OwnerProduct, field: "isAvailable" | "isFeatured") {
    if (busy) return;
    setBusy(true); setActionError("");
    try {
      const result = await patchOwnerProduct(product.id, { [field]: !product[field] });
      setFeedback(productFeedback(locale, result.name, "updated")); refreshProducts();
    } catch (error) { setActionError(failure(error, ownerText(locale, "Could not update this product."))); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!deleteTarget || busy) return;
    setBusy(true); setModalError(""); setDeleteConflict(false);
    try {
      await deleteOwnerProduct(deleteTarget.id);
      setFeedback(productFeedback(locale, deleteTarget.name, "deleted")); setActionError(""); setDeleteTarget(null); refreshProducts();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setDeleteConflict(true);
        setModalError(ownerText(locale, "This Product appears in a historical Order and cannot be deleted. Mark it unavailable instead."));
      } else setModalError(failure(error, ownerText(locale, "Could not confirm deletion. Refresh to check current data.")));
    } finally { setBusy(false); }
  }

  async function makeUnavailable() {
    if (!deleteTarget || busy) return;
    setBusy(true); setModalError("");
    try {
      const result = await patchOwnerProduct(deleteTarget.id, { isAvailable: false });
      setFeedback(productFeedback(locale, result.name, "unavailable")); setActionError(""); setDeleteTarget(null); setDeleteConflict(false); refreshProducts();
    } catch (error) { setModalError(failure(error, ownerText(locale, "Could not make this product unavailable."))); }
    finally { setBusy(false); }
  }

  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories]);
  const visible = products.filter((product) => !query.trim() ||
    [product.name, product.slug, product.description ?? "", categoryMap.get(product.categoryId)?.name ?? ""].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const price = (value: number) => formatOwnerPrice(value, currency, locale);
  const image = (product: OwnerProduct) => product.imageUrl || product.images[0] || null;

  function field(key: TextKey, label: string, textarea = false) {
    const id = `product-${key}`;
    const props = { id, value: form[key], disabled: busy, "aria-invalid": Boolean(errors[key]),
      "aria-describedby": errors[key] ? `product-error-${key}` : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm({ ...form, [key]: event.target.value }); setErrors({ ...errors, [key]: undefined }); } };
    return <div key={key}><label htmlFor={id} className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">{label}</label>
      {textarea ? <textarea {...props} className={textareaClass} /> : <input {...props} className={inputClass} inputMode={key === "price" || key === "oldPrice" || key === "calories" || key === "preparationTime" ? "decimal" : undefined} />}
      {errors[key] ? <p className="mt-1 text-sm text-red-300" id={`product-error-${key}`}>{ownerText(locale, errors[key]!)}</p> : null}</div>;
  }

  function actions(product: OwnerProduct) {
    return <div className="flex flex-wrap gap-2">
      <ActionButton variant="ghost" className="min-h-10 px-3" disabled={busy} onClick={() => setImageTarget(product)}><ImageIcon aria-hidden="true" size={15} />{ownerText((ar ? "ar" : "en"), "Image")}</ActionButton>
      <ActionButton variant="ghost" className="min-h-10 px-3" disabled={busy || openingId !== null} onClick={() => void openEdit(product)}><Edit3 aria-hidden="true" size={15} />{openingId === product.id ? ownerText((ar ? "ar" : "en"), "Opening…") : ownerText((ar ? "ar" : "en"), "Edit")}</ActionButton>
      <ActionButton variant="ghost" className="min-h-10 px-3" disabled={busy} onClick={() => void toggle(product, "isAvailable")}>{product.isAvailable ? ownerText((ar ? "ar" : "en"), "Make unavailable") : ownerText((ar ? "ar" : "en"), "Make available")}</ActionButton>
      <ActionButton variant="ghost" className="min-h-10 px-3" disabled={busy} onClick={() => void toggle(product, "isFeatured")}>{product.isFeatured ? ownerText((ar ? "ar" : "en"), "Unfeature") : ownerText((ar ? "ar" : "en"), "Feature")}</ActionButton>
      <ActionButton variant="danger" className="min-h-10 px-3" disabled={busy} onClick={() => { setDeleteTarget(product); setDeleteConflict(false); setModalError(""); }}><Trash2 aria-hidden="true" size={15} />{ownerText((ar ? "ar" : "en"), "Delete")}</ActionButton>
    </div>;
  }

  async function removeGalleryImage(url: string) {
    if (!imageTarget || galleryBusy || !mediaAvailable) return;
    const assetId = /\/media\/([0-9a-f]{24})\/large$/.exec(url)?.[1];
    if (!assetId) return;
    setGalleryBusy(true); setGalleryError("");
    try {
      await deleteOwnerGalleryImage(imageTarget.id, assetId);
      const images = imageTarget.images.filter((item) => item !== url);
      setImageTarget({ ...imageTarget, images });
      setProducts((items) => items.map((item) => item.id === imageTarget.id ? { ...item, images } : item));
      refreshProducts();
    } catch (error) {
      setGalleryError(ar ? ownerText("ar", "Could not remove image.") : error instanceof Error ? error.message : "Could not remove image.");
    } finally { setGalleryBusy(false); }
  }

  return <section>
    <DashboardPageHeader eyebrow={ar ? "إدارة المنيو" : "Menu Control"} title={ar ? "المنتجات" : "Products"} description={ar ? "إدارة المنتجات وتوفرها وأماكنها في المنيو." : "Manage real products, availability, and menu placement."}
      action={<ActionButton disabled={!categories.length || categoryLoading || Boolean(categoryError)} onClick={openCreate}><Plus aria-hidden="true" size={17} />{ar ? "إضافة منتج" : ownerText((ar ? "ar" : "en"), "Add Product")}</ActionButton>} />
    <CatalogToast message={actionError || feedback} error={Boolean(actionError)} onClose={() => { setActionError(""); setFeedback(""); }} />
    {categoryError ? <DashboardCard className="mb-5 p-5"><p role="alert" className="text-red-200">{categoryError}</p><ActionButton className="mt-4" onClick={refreshCategories}>{ownerText((ar ? "ar" : "en"), "Retry Categories")}</ActionButton></DashboardCard> : null}
    {!categoryLoading && !categoryError && categories.length === 0 ? <DashboardCard className="mb-5 p-5"><p>{ownerText((ar ? "ar" : "en"), "Create a Category before adding Products.")}</p><Link className="mt-3 inline-block text-[color:var(--primary-light)] underline" href={routes.categories}>{ownerText((ar ? "ar" : "en"), "Go to Categories")}</Link></DashboardCard> : null}
    <DashboardCard className="p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_repeat(4,minmax(8rem,0.65fr))]">
      <SearchInput value={query} onChange={setQuery} placeholder={ar ? "ابحث في منتجات هذه الصفحة..." : "Search this page of products..."} />
      <select aria-label={ownerText((ar ? "ar" : "en"), "Filter by category")} className={`${inputClass} appearance-none`} value={categoryId} onChange={(event) => changeFilter(() => setCategoryId(event.target.value))}><option value="">{ownerText((ar ? "ar" : "en"), "All categories")}</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : ownerText((ar ? "ar" : "en"), " (inactive)")}</option>)}</select>
      <select aria-label={ownerText((ar ? "ar" : "en"), "Filter by availability")} className={`${inputClass} appearance-none`} value={available} onChange={(event) => changeFilter(() => setAvailable(event.target.value))}><option value="all">{ownerText((ar ? "ar" : "en"), "Any availability")}</option><option value="true">{ownerText((ar ? "ar" : "en"), "Available")}</option><option value="false">{ownerText((ar ? "ar" : "en"), "Unavailable")}</option></select>
      <select aria-label={ownerText((ar ? "ar" : "en"), "Filter by featured")} className={`${inputClass} appearance-none`} value={featured} onChange={(event) => changeFilter(() => setFeatured(event.target.value))}><option value="all">{ownerText((ar ? "ar" : "en"), "Any featured")}</option><option value="true">{ownerText((ar ? "ar" : "en"), "Featured")}</option><option value="false">{ownerText((ar ? "ar" : "en"), "Not featured")}</option></select>
      <select aria-label={ownerText((ar ? "ar" : "en"), "Product sort")} className={`${inputClass} appearance-none`} value={sort} onChange={(event) => changeFilter(() => setSort(event.target.value as ProductSort))}><option value="-createdAt">{ownerText((ar ? "ar" : "en"), "Newest")}</option><option value="createdAt">{ownerText((ar ? "ar" : "en"), "Oldest")}</option><option value="name">{ownerText((ar ? "ar" : "en"), "Name A–Z")}</option><option value="-name">{ownerText((ar ? "ar" : "en"), "Name Z–A")}</option><option value="price">{ownerText((ar ? "ar" : "en"), "Price low–high")}</option><option value="-price">{ownerText((ar ? "ar" : "en"), "Price high–low")}</option></select>
    </div></DashboardCard>
    {loading || categoryLoading ? <div role="status" aria-label={ownerText((ar ? "ar" : "en"), "Loading products")} className="mt-6 grid animate-pulse gap-4">{Array.from({ length: 5 }, (_, index) => <DashboardCard className="h-24" key={index}><div className="h-full bg-white/[0.035]" /></DashboardCard>)}</div> :
      loadError ? <DashboardCard className="mt-6 p-6"><p role="alert" className="text-red-200">{loadError}</p><ActionButton className="mt-4" onClick={refreshProducts}>{ownerText((ar ? "ar" : "en"), "Retry")}</ActionButton></DashboardCard> :
      pagination?.total === 0 ? <DashboardCard className="mt-6 p-8 text-center"><Package className="mx-auto text-[color:var(--primary-light)]" size={30} /><h3 className="mt-4 text-xl font-semibold">{ownerText((ar ? "ar" : "en"), "No products found")}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "Try another filter or add a Product to a Category.")}</p></DashboardCard> :
      visible.length === 0 ? <DashboardCard className="mt-6 p-6 text-center">{ownerText((ar ? "ar" : "en"), "No products match on this page.")}</DashboardCard> :
      <div className="mt-6 grid gap-4">
        <div className="hidden overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] xl:block"><table className="w-full text-start text-sm"><thead className="text-xs font-semibold tracking-[0.16em] text-[color:var(--gold)] uppercase"><tr className="border-b border-white/10"><th className="px-5 py-4">{ownerText((ar ? "ar" : "en"), "Product")}</th><th className="px-5 py-4">{ownerText((ar ? "ar" : "en"), "Category")}</th><th className="px-5 py-4">{ownerText((ar ? "ar" : "en"), "Price")}</th><th className="px-5 py-4">{ownerText((ar ? "ar" : "en"), "Status")}</th><th className="px-5 py-4">{ownerText((ar ? "ar" : "en"), "Featured")}</th><th className="px-5 py-4">{ownerText((ar ? "ar" : "en"), "Actions")}</th></tr></thead><tbody className="divide-y divide-white/10">{visible.map((product) => <tr key={product.id} className="text-[color:var(--text-muted)]"><td className="px-5 py-4"><div className="flex items-center gap-4"><div className="relative size-14 shrink-0 overflow-hidden rounded-xl"><CatalogImage key={`${product.id}:${image(product)}`} alt={product.name} src={image(product)} sizes="3.5rem" /></div><div><div className="font-semibold text-[color:var(--text)]">{product.name}</div><div className="line-clamp-1 max-w-md text-xs">{product.description || ownerText((ar ? "ar" : "en"), "No description")}</div></div></div></td><td className="px-5 py-4">{categoryMap.get(product.categoryId)?.name ?? ownerText((ar ? "ar" : "en"), "Category unavailable")}{categoryMap.get(product.categoryId)?.isActive === false ? <span className="block text-xs text-amber-200">{ownerText((ar ? "ar" : "en"), "Inactive category · hidden publicly")}</span> : null}</td><td className="px-5 py-4 text-[color:var(--primary-light)]">{price(product.price)}{product.oldPrice !== null ? <span className="block text-xs text-[color:var(--text-muted)] line-through">{price(product.oldPrice)}</span> : null}</td><td className="px-5 py-4"><StatusBadge status={product.isAvailable ? "Available" : "Unavailable"} /></td><td className="px-5 py-4">{product.isFeatured ? ownerText((ar ? "ar" : "en"), "Yes") : ownerText((ar ? "ar" : "en"), "No")}</td><td className="px-5 py-4">{actions(product)}</td></tr>)}</tbody></table></div>
        <div className="grid gap-4 xl:hidden">{visible.map((product) => <article key={product.id} className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.078),rgba(255,255,255,0.028)_60%,rgba(255,122,0,0.04))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)]"><div className="grid gap-4 sm:grid-cols-[6rem_1fr]"><div className="relative aspect-square overflow-hidden rounded-xl"><CatalogImage key={`${product.id}:${image(product)}`} alt={product.name} src={image(product)} sizes="6rem" /></div><div><h3 className="text-xl font-semibold">{product.name}</h3><p className="mt-1 text-sm text-[color:var(--text-muted)]">{product.description || ownerText((ar ? "ar" : "en"), "No description")}</p><div className="mt-3 flex flex-wrap gap-3 text-sm text-[color:var(--text-muted)]"><span>{categoryMap.get(product.categoryId)?.name ?? ownerText((ar ? "ar" : "en"), "Category unavailable")}</span><span>{price(product.price)}</span><StatusBadge status={product.isAvailable ? "Available" : "Unavailable"} />{product.isFeatured ? <span>{ownerText((ar ? "ar" : "en"), "Featured")}</span> : null}</div>{categoryMap.get(product.categoryId)?.isActive === false ? <p className="mt-2 text-xs text-amber-200">{ownerText((ar ? "ar" : "en"), "Inactive category · hidden from public menu")}</p> : null}<div className="mt-4">{actions(product)}</div></div></div></article>)}</div>
      </div>}
    {!loading && !loadError && pagination && pagination.total > limit ? <div className="mt-6 flex items-center justify-center gap-4"><ActionButton variant="ghost" disabled={page <= 1} onClick={() => { setLoading(true); setPage(page - 1); }}>{ownerText((ar ? "ar" : "en"), "Previous")}</ActionButton><span className="text-sm text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "Page")}{" "}{page} {ownerText((ar ? "ar" : "en"), "of")}{" "}{Math.ceil(pagination.total / limit)}</span><ActionButton variant="ghost" disabled={!pagination.hasNext} onClick={() => { setLoading(true); setPage(page + 1); }}>{ownerText((ar ? "ar" : "en"), "Next")}</ActionButton></div> : null}
    <DashboardModal open={mode !== null} title={mode === "edit" ? ownerText((ar ? "ar" : "en"), "Edit Product") : ownerText((ar ? "ar" : "en"), "Add Product")} onClose={closeModal}><form noValidate className="grid gap-4" onSubmit={(event) => void save(event)}>
      {field("name", ar ? "اسم المنتج" : "Product Name")}
      <div><label htmlFor="product-category" className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">{ownerText((ar ? "ar" : "en"), "Category")}</label><select id="product-category" className={`${inputClass} appearance-none`} disabled={busy} value={form.categoryId} aria-invalid={Boolean(errors.categoryId)} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : ownerText((ar ? "ar" : "en"), " (inactive — hidden publicly)")}</option>)}</select>{errors.categoryId ? <p className="mt-1 text-sm text-red-300">{ownerText(locale, errors.categoryId)}</p> : null}</div>
      <div className="grid gap-4 sm:grid-cols-2">{field("price", ar ? `السعر (${currency})` : `Price (${currency}, ${currencyDigits(currency)} decimals)`)}{field("oldPrice", ar ? `السعر القديم (${currency}، اختياري)` : `Old Price (${currency}, optional)`)}</div>
      {field("description", ownerText((ar ? "ar" : "en"), "Description"), true)}{field("imageUrl", ownerText((ar ? "ar" : "en"), "Primary Image URL"))}{field("images", ownerText((ar ? "ar" : "en"), "Additional Image URLs — one per line"), true)}
      <div className="grid gap-4 sm:grid-cols-2">{field("preparationTime", ownerText((ar ? "ar" : "en"), "Preparation Time (minutes)"))}{field("calories", ownerText((ar ? "ar" : "en"), "Calories"))}</div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span>{ownerText((ar ? "ar" : "en"), "Available")}</span><input type="checkbox" checked={form.isAvailable} disabled={busy} onChange={(event) => setForm({ ...form, isAvailable: event.target.checked })} className="size-5 accent-[color:var(--primary)]" /></label><label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span>{ownerText((ar ? "ar" : "en"), "Featured")}</span><input type="checkbox" checked={form.isFeatured} disabled={busy} onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })} className="size-5 accent-[color:var(--primary)]" /></label></div>
      {modalError ? <p role="alert" className="text-sm text-red-200">{modalError}</p> : null}<div className="flex justify-end gap-3"><ActionButton variant="ghost" disabled={busy} onClick={closeModal}>{ownerText((ar ? "ar" : "en"), "Cancel")}</ActionButton><ActionButton type="submit" disabled={busy}>{busy ? ownerText((ar ? "ar" : "en"), "Saving…") : ownerText((ar ? "ar" : "en"), "Save Product")}</ActionButton></div>
    </form></DashboardModal>
    <DashboardModal open={deleteTarget !== null} title={ownerText((ar ? "ar" : "en"), "Delete Product")} onClose={closeModal}><p>{ownerText((ar ? "ar" : "en"), "Delete")}{" "}<strong>{deleteTarget?.name}</strong>{ownerText((ar ? "ar" : "en"), "? This cannot be undone.")}</p><p className="mt-2 text-sm text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "Products used by historical Orders cannot be permanently deleted.")}</p>{modalError ? <p role="alert" className="mt-4 text-sm text-red-200">{modalError}</p> : null}<div className="mt-6 flex flex-wrap justify-end gap-3"><ActionButton variant="ghost" disabled={busy} onClick={closeModal}>{ownerText((ar ? "ar" : "en"), "Cancel")}</ActionButton>{deleteConflict ? <ActionButton disabled={busy} onClick={() => void makeUnavailable()}>{busy ? ownerText((ar ? "ar" : "en"), "Saving…") : ownerText((ar ? "ar" : "en"), "Mark Unavailable")}</ActionButton> : <ActionButton variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? ownerText((ar ? "ar" : "en"), "Deleting…") : ownerText((ar ? "ar" : "en"), "Delete Product")}</ActionButton>}</div></DashboardModal>
    <DashboardModal open={imageTarget !== null} title={imageTarget ? productImagesTitle(locale, imageTarget.name) : ownerText((ar ? "ar" : "en"), "Product images")} onClose={() => { if (!galleryBusy) { setImageTarget(null); setGalleryError(""); } }}>
      {imageTarget && <div className="grid gap-4">
        <OwnerImageUpload target={{ kind: "product", id: imageTarget.id }} currentUrl={imageTarget.imageUrl} onChanged={(url) => {
          setImageTarget({ ...imageTarget, imageUrl: url });
          setProducts((items) => items.map((item) => item.id === imageTarget.id ? { ...item, imageUrl: url } : item));
          refreshProducts();
        }} />
        {imageTarget.images.length < 10 ? <OwnerImageUpload target={{ kind: "gallery", id: imageTarget.id }} currentUrl={null} onChanged={(url) => {
          if (url && !imageTarget.images.includes(url)) {
            const images = [...imageTarget.images, url];
            setImageTarget({ ...imageTarget, images });
            setProducts((items) => items.map((item) => item.id === imageTarget.id ? { ...item, images } : item));
            refreshProducts();
          }
        }} /> : <p className="text-sm text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "This product has 10 additional images. Remove one before uploading another.")}</p>}
        {imageTarget.images.length > 0 && <div><h3 className="text-sm font-semibold">{ownerText((ar ? "ar" : "en"), "Additional images")}</h3><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{imageTarget.images.map((url, index) =>
          <div className="rounded-lg border border-white/10 p-2" key={url}>
            <div className="relative aspect-square overflow-hidden rounded"><CatalogImage src={url} alt={productImageLabel(locale, imageTarget.name, index + 1)} sizes="120px" /></div>
            {mediaAvailable && isManagedImage(url) && <button type="button" className="mt-2 min-h-10 text-sm text-red-200 underline disabled:opacity-50" disabled={galleryBusy} onClick={() => void removeGalleryImage(url)}>{ownerText((ar ? "ar" : "en"), "Remove image")}</button>}
          </div>)}</div></div>}
        {galleryError && <p role="alert" className="text-sm text-red-200">{galleryError}</p>}
      </div>}
    </DashboardModal>
  </section>;
}
