"use client";

import { Edit3, Package, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { ApiError } from "@/services/api-client";
import { ownerCatalogError, type OwnerPagination } from "@/services/owner-catalog-common";
import { allOwnerCategories, type OwnerCategory } from "@/services/owner-categories-service";
import { createOwnerProduct, currencyDigits, deleteOwnerProduct, formatOwnerPrice, getOwnerProduct,
  listOwnerProducts, patchOwnerProduct, productPatch, productToForm, productWrite, validateProductForm,
  type OwnerProduct, type ProductFormValues, type ProductSort } from "@/services/owner-products-service";
import { useAuthStore } from "@/store/auth-store";
import { CatalogImage } from "./CatalogImage";
import { CatalogToast } from "./CatalogToast";
import { ActionButton, DashboardCard, DashboardModal, DashboardPageHeader, SearchInput, StatusBadge, inputClass, textareaClass } from "./DashboardUI";

const limit = 12;
type Errors = Partial<Record<keyof ProductFormValues, string>>;
type TextKey = Exclude<keyof ProductFormValues, "isAvailable" | "isFeatured">;

export function DashboardProductsPage() {
  const context = useAuthStore((state) => state.context);
  if (!context) return null;
  return <ProductEditor key={`${context.restaurant.id}:${context.restaurant.currency}`} currency={context.restaurant.currency} />;
}

function ProductEditor({ currency }: { currency: string }) {
  const locale = useLocale();
  const restore = useAuthStore((state) => state.restore);
  const [products, setProducts] = useState<OwnerProduct[]>([]);
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
      setCategoryError(ownerCatalogError(error, "Could not load categories. Retry to select a real category."));
      setCategoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [categoryRevision, restore]);

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
      setLoadError(ownerCatalogError(error, "Could not load products. Retry when the connection is available."));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [page, sort, categoryId, available, featured, revision, restore]);

  function refreshProducts() { setLoading(true); setLoadError(""); setRevision((value) => value + 1); }
  function refreshCategories() { setCategoryLoading(true); setCategoryError(""); setCategoryRevision((value) => value + 1); }
  function changeFilter(change: () => void) { setLoading(true); setLoadError(""); setPage(1); change(); }
  function failure(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.status === 401) { void restore(); return ""; }
    if (error instanceof ApiError && error.status === 404) { refreshCategories(); refreshProducts(); }
    return ownerCatalogError(error, fallback);
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
    } catch (error) { setActionError(failure(error, "Could not open this product. Retry.")); }
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
      setFeedback(`${result.name} ${editing ? "updated" : "created"}.`); setActionError("");
      setMode(null); setEditing(null);
      if (!editing) setPage(1);
      refreshProducts();
    } catch (error) { setModalError(failure(error, "Could not confirm the save. Retry or refresh to check current data.")); }
    finally { setBusy(false); }
  }

  async function toggle(product: OwnerProduct, field: "isAvailable" | "isFeatured") {
    if (busy) return;
    setBusy(true); setActionError("");
    try {
      const result = await patchOwnerProduct(product.id, { [field]: !product[field] });
      setFeedback(`${result.name} updated.`); refreshProducts();
    } catch (error) { setActionError(failure(error, "Could not update this product.")); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!deleteTarget || busy) return;
    setBusy(true); setModalError(""); setDeleteConflict(false);
    try {
      await deleteOwnerProduct(deleteTarget.id);
      setFeedback(`${deleteTarget.name} deleted.`); setActionError(""); setDeleteTarget(null); refreshProducts();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setDeleteConflict(true);
        setModalError("This Product appears in a historical Order and cannot be deleted. Mark it unavailable instead.");
      } else setModalError(failure(error, "Could not confirm deletion. Refresh to check current data."));
    } finally { setBusy(false); }
  }

  async function makeUnavailable() {
    if (!deleteTarget || busy) return;
    setBusy(true); setModalError("");
    try {
      const result = await patchOwnerProduct(deleteTarget.id, { isAvailable: false });
      setFeedback(`${result.name} is now unavailable.`); setActionError(""); setDeleteTarget(null); setDeleteConflict(false); refreshProducts();
    } catch (error) { setModalError(failure(error, "Could not make this product unavailable.")); }
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
      {errors[key] ? <p className="mt-1 text-sm text-red-300" id={`product-error-${key}`}>{errors[key]}</p> : null}</div>;
  }

  function actions(product: OwnerProduct) {
    return <div className="flex flex-wrap gap-2">
      <ActionButton variant="ghost" className="min-h-10 px-3" disabled={busy || openingId !== null} onClick={() => void openEdit(product)}><Edit3 aria-hidden="true" size={15} />{openingId === product.id ? "Opening…" : "Edit"}</ActionButton>
      <ActionButton variant="ghost" className="min-h-10 px-3" disabled={busy} onClick={() => void toggle(product, "isAvailable")}>{product.isAvailable ? "Make unavailable" : "Make available"}</ActionButton>
      <ActionButton variant="ghost" className="min-h-10 px-3" disabled={busy} onClick={() => void toggle(product, "isFeatured")}>{product.isFeatured ? "Unfeature" : "Feature"}</ActionButton>
      <ActionButton variant="danger" className="min-h-10 px-3" disabled={busy} onClick={() => { setDeleteTarget(product); setDeleteConflict(false); setModalError(""); }}><Trash2 aria-hidden="true" size={15} />Delete</ActionButton>
    </div>;
  }

  return <section>
    <DashboardPageHeader eyebrow="Menu Control" title="Products" description="Manage real products, availability, and menu placement."
      action={<ActionButton disabled={!categories.length || categoryLoading || Boolean(categoryError)} onClick={openCreate}><Plus aria-hidden="true" size={17} />Add Product</ActionButton>} />
    <CatalogToast message={actionError || feedback} error={Boolean(actionError)} onClose={() => { setActionError(""); setFeedback(""); }} />
    {categoryError ? <DashboardCard className="mb-5 p-5"><p role="alert" className="text-red-200">{categoryError}</p><ActionButton className="mt-4" onClick={refreshCategories}>Retry Categories</ActionButton></DashboardCard> : null}
    {!categoryLoading && !categoryError && categories.length === 0 ? <DashboardCard className="mb-5 p-5"><p>Create a Category before adding Products.</p><Link className="mt-3 inline-block text-[color:var(--primary-light)] underline" href={routes.categories}>Go to Categories</Link></DashboardCard> : null}
    <DashboardCard className="p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_repeat(4,minmax(8rem,0.65fr))]">
      <SearchInput value={query} onChange={setQuery} placeholder="Search this page of products..." />
      <select aria-label="Filter by category" className={`${inputClass} appearance-none`} value={categoryId} onChange={(event) => changeFilter(() => setCategoryId(event.target.value))}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " (inactive)"}</option>)}</select>
      <select aria-label="Filter by availability" className={`${inputClass} appearance-none`} value={available} onChange={(event) => changeFilter(() => setAvailable(event.target.value))}><option value="all">Any availability</option><option value="true">Available</option><option value="false">Unavailable</option></select>
      <select aria-label="Filter by featured" className={`${inputClass} appearance-none`} value={featured} onChange={(event) => changeFilter(() => setFeatured(event.target.value))}><option value="all">Any featured</option><option value="true">Featured</option><option value="false">Not featured</option></select>
      <select aria-label="Product sort" className={`${inputClass} appearance-none`} value={sort} onChange={(event) => changeFilter(() => setSort(event.target.value as ProductSort))}><option value="-createdAt">Newest</option><option value="createdAt">Oldest</option><option value="name">Name A–Z</option><option value="-name">Name Z–A</option><option value="price">Price low–high</option><option value="-price">Price high–low</option></select>
    </div></DashboardCard>
    {loading || categoryLoading ? <div role="status" aria-label="Loading products" className="mt-6 grid animate-pulse gap-4">{Array.from({ length: 5 }, (_, index) => <DashboardCard className="h-24" key={index}><div className="h-full bg-white/[0.035]" /></DashboardCard>)}</div> :
      loadError ? <DashboardCard className="mt-6 p-6"><p role="alert" className="text-red-200">{loadError}</p><ActionButton className="mt-4" onClick={refreshProducts}>Retry</ActionButton></DashboardCard> :
      pagination?.total === 0 ? <DashboardCard className="mt-6 p-8 text-center"><Package className="mx-auto text-[color:var(--primary-light)]" size={30} /><h3 className="mt-4 text-xl font-semibold">No products found</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">Try another filter or add a Product to a Category.</p></DashboardCard> :
      visible.length === 0 ? <DashboardCard className="mt-6 p-6 text-center">No products match on this page.</DashboardCard> :
      <div className="mt-6 grid gap-4">
        <div className="hidden overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] xl:block"><table className="w-full text-left text-sm"><thead className="text-xs font-semibold tracking-[0.16em] text-[color:var(--gold)] uppercase"><tr className="border-b border-white/10"><th className="px-5 py-4">Product</th><th className="px-5 py-4">Category</th><th className="px-5 py-4">Price</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Featured</th><th className="px-5 py-4">Actions</th></tr></thead><tbody className="divide-y divide-white/10">{visible.map((product) => <tr key={product.id} className="text-[color:var(--text-muted)]"><td className="px-5 py-4"><div className="flex items-center gap-4"><div className="relative size-14 shrink-0 overflow-hidden rounded-xl"><CatalogImage key={`${product.id}:${image(product)}`} alt={product.name} src={image(product)} sizes="3.5rem" /></div><div><div className="font-semibold text-[color:var(--text)]">{product.name}</div><div className="line-clamp-1 max-w-md text-xs">{product.description || "No description"}</div></div></div></td><td className="px-5 py-4">{categoryMap.get(product.categoryId)?.name ?? "Category unavailable"}{categoryMap.get(product.categoryId)?.isActive === false ? <span className="block text-xs text-amber-200">Inactive category · hidden publicly</span> : null}</td><td className="px-5 py-4 text-[color:var(--primary-light)]">{price(product.price)}{product.oldPrice !== null ? <span className="block text-xs text-[color:var(--text-muted)] line-through">{price(product.oldPrice)}</span> : null}</td><td className="px-5 py-4"><StatusBadge status={product.isAvailable ? "Available" : "Unavailable"} /></td><td className="px-5 py-4">{product.isFeatured ? "Yes" : "No"}</td><td className="px-5 py-4">{actions(product)}</td></tr>)}</tbody></table></div>
        <div className="grid gap-4 xl:hidden">{visible.map((product) => <article key={product.id} className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.078),rgba(255,255,255,0.028)_60%,rgba(255,122,0,0.04))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)]"><div className="grid gap-4 sm:grid-cols-[6rem_1fr]"><div className="relative aspect-square overflow-hidden rounded-xl"><CatalogImage key={`${product.id}:${image(product)}`} alt={product.name} src={image(product)} sizes="6rem" /></div><div><h3 className="text-xl font-semibold">{product.name}</h3><p className="mt-1 text-sm text-[color:var(--text-muted)]">{product.description || "No description"}</p><div className="mt-3 flex flex-wrap gap-3 text-sm text-[color:var(--text-muted)]"><span>{categoryMap.get(product.categoryId)?.name ?? "Category unavailable"}</span><span>{price(product.price)}</span><StatusBadge status={product.isAvailable ? "Available" : "Unavailable"} />{product.isFeatured ? <span>Featured</span> : null}</div>{categoryMap.get(product.categoryId)?.isActive === false ? <p className="mt-2 text-xs text-amber-200">Inactive category · hidden from public menu</p> : null}<div className="mt-4">{actions(product)}</div></div></div></article>)}</div>
      </div>}
    {!loading && !loadError && pagination && pagination.total > limit ? <div className="mt-6 flex items-center justify-center gap-4"><ActionButton variant="ghost" disabled={page <= 1} onClick={() => { setLoading(true); setPage(page - 1); }}>Previous</ActionButton><span className="text-sm text-[color:var(--text-muted)]">Page {page} of {Math.ceil(pagination.total / limit)}</span><ActionButton variant="ghost" disabled={!pagination.hasNext} onClick={() => { setLoading(true); setPage(page + 1); }}>Next</ActionButton></div> : null}
    <DashboardModal open={mode !== null} title={mode === "edit" ? "Edit Product" : "Add Product"} onClose={closeModal}><form noValidate className="grid gap-4" onSubmit={(event) => void save(event)}>
      <div className="grid gap-4 sm:grid-cols-2">{field("name", "Product Name")}{field("slug", "Slug")}</div>
      <div><label htmlFor="product-category" className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">Category</label><select id="product-category" className={`${inputClass} appearance-none`} disabled={busy} value={form.categoryId} aria-invalid={Boolean(errors.categoryId)} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " (inactive — hidden publicly)"}</option>)}</select>{errors.categoryId ? <p className="mt-1 text-sm text-red-300">{errors.categoryId}</p> : null}</div>
      <div className="grid gap-4 sm:grid-cols-2">{field("price", `Price (${currency}, ${currencyDigits(currency)} decimals)`)}{field("oldPrice", `Old Price (${currency}, optional)`)}</div>
      {field("description", "Description", true)}{field("imageUrl", "Primary Image URL")}{field("images", "Additional Image URLs — one per line", true)}
      <div className="grid gap-4 sm:grid-cols-2">{field("preparationTime", "Preparation Time (minutes)")}{field("calories", "Calories")}</div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span>Available</span><input type="checkbox" checked={form.isAvailable} disabled={busy} onChange={(event) => setForm({ ...form, isAvailable: event.target.checked })} className="size-5 accent-[color:var(--primary)]" /></label><label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span>Featured</span><input type="checkbox" checked={form.isFeatured} disabled={busy} onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })} className="size-5 accent-[color:var(--primary)]" /></label></div>
      {modalError ? <p role="alert" className="text-sm text-red-200">{modalError}</p> : null}<div className="flex justify-end gap-3"><ActionButton variant="ghost" disabled={busy} onClick={closeModal}>Cancel</ActionButton><ActionButton type="submit" disabled={busy}>{busy ? "Saving…" : "Save Product"}</ActionButton></div>
    </form></DashboardModal>
    <DashboardModal open={deleteTarget !== null} title="Delete Product" onClose={closeModal}><p>Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p><p className="mt-2 text-sm text-[color:var(--text-muted)]">Products used by historical Orders cannot be permanently deleted.</p>{modalError ? <p role="alert" className="mt-4 text-sm text-red-200">{modalError}</p> : null}<div className="mt-6 flex flex-wrap justify-end gap-3"><ActionButton variant="ghost" disabled={busy} onClick={closeModal}>Cancel</ActionButton>{deleteConflict ? <ActionButton disabled={busy} onClick={() => void makeUnavailable()}>{busy ? "Saving…" : "Mark Unavailable"}</ActionButton> : <ActionButton variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete Product"}</ActionButton>}</div></DashboardModal>
  </section>;
}
