"use client";

import { Edit3, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { ApiError } from "@/services/api-client";
import { ownerCatalogError, type OwnerPagination } from "@/services/owner-catalog-common";
import { categoryPatch, categoryToForm, categoryWrite, createOwnerCategory, deleteOwnerCategory,
  getOwnerCategory, listOwnerCategories, patchOwnerCategory, validateCategoryForm,
  type CategoryFormValues, type CategorySort, type OwnerCategory } from "@/services/owner-categories-service";
import { useAuthStore } from "@/store/auth-store";
import { CatalogImage } from "./CatalogImage";
import { CatalogToast } from "./CatalogToast";
import { ActionButton, DashboardCard, DashboardModal, DashboardPageHeader, SearchInput, StatusBadge, inputClass, textareaClass } from "./DashboardUI";

const limit = 12;
type Errors = Partial<Record<keyof CategoryFormValues, string>>;

export function DashboardCategoriesPage() {
  const ownerId = useAuthStore((state) => state.context?.restaurant.id);
  if (!ownerId) return null;
  return <CategoryEditor key={ownerId} />;
}

function CategoryEditor() {
  const ar = useLocale() === "ar";
  const restore = useAuthStore((state) => state.restore);
  const [items, setItems] = useState<OwnerCategory[]>([]);
  const [pagination, setPagination] = useState<OwnerPagination | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<CategorySort>("sortOrder");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<OwnerCategory | null>(null);
  const [form, setForm] = useState<CategoryFormValues>(categoryToForm());
  const [errors, setErrors] = useState<Errors>({});
  const [modalError, setModalError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OwnerCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listOwnerCategories({ page, limit, sort }).then((result) => {
      if (cancelled) return;
      if (page > 1 && result.categories.length === 0) {
        setPage(page - 1);
        return;
      }
      setItems(result.categories);
      setPagination(result.pagination);
      setLoading(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof ApiError && error.status === 401) { void restore(); return; }
      setLoadError(ownerCatalogError(error, "Could not load categories. Retry when the connection is available."));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [page, sort, revision, restore]);

  function refresh() { setLoading(true); setLoadError(""); setRevision((value) => value + 1); }
  function changePage(next: number) { setLoading(true); setLoadError(""); setPage(next); }
  function changeSort(next: CategorySort) { setLoading(true); setLoadError(""); setPage(1); setSort(next); }
  function failure(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.status === 401) { void restore(); return ""; }
    return ar ? "تعذّر إكمال العملية. راجع الاتصال وحاول مرة أخرى." : ownerCatalogError(error, fallback);
  }

  function openCreate() { setForm(categoryToForm()); setEditing(null); setErrors({}); setModalError(""); setMode("create"); }
  async function openEdit(category: OwnerCategory) {
    if (openingId) return;
    setOpeningId(category.id);
    try {
      const detail = await getOwnerCategory(category.id);
      setEditing(detail); setForm(categoryToForm(detail)); setErrors({}); setModalError(""); setMode("edit");
    } catch (error) { setActionError(failure(error, "Could not open this category. Retry.")); refresh(); }
    finally { setOpeningId(null); }
  }
  function closeModal() { if (!busy) { setMode(null); setEditing(null); setDeleteTarget(null); setModalError(""); } }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const validation = validateCategoryForm(form);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const patch = editing ? categoryPatch(form, editing) : null;
    if (patch && !Object.keys(patch).length) { closeModal(); return; }
    setBusy(true); setModalError("");
    try {
      const result = editing ? await patchOwnerCategory(editing.id, patch!) : await createOwnerCategory(categoryWrite(form));
      setFeedback(ar ? `تم ${editing ? "تعديل" : "إضافة"} ${result.name}.` : `${result.name} ${editing ? "updated" : "created"}.`);
      setActionError("");
      setMode(null); setEditing(null);
      if (!editing) setPage(1);
      refresh();
    } catch (error) { setModalError(failure(error, "Could not confirm the save. Retry or refresh to check current data.")); }
    finally { setBusy(false); }
  }

  async function toggle(category: OwnerCategory) {
    if (busy) return;
    setBusy(true); setFeedback(""); setActionError("");
    try {
      const result = await patchOwnerCategory(category.id, { isActive: !category.isActive });
      setFeedback(ar ? `تم ${result.isActive ? "تنشيط" : "إيقاف"} ${result.name}.` : `${result.name} is now ${result.isActive ? "active" : "inactive"}.`);
      refresh();
    } catch (error) { setActionError(failure(error, "Could not update category status.")); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!deleteTarget || busy) return;
    setBusy(true); setModalError("");
    try {
      await deleteOwnerCategory(deleteTarget.id);
      setFeedback(ar ? `تم حذف ${deleteTarget.name}.` : `${deleteTarget.name} deleted.`);
      setActionError("");
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      setModalError(error instanceof ApiError && error.status === 409 ?
        (ar ? "القسم يحتوي على منتجات. انقلها أو احذفها أولًا، أو أوقف القسم." : "This category still has Products. Move or remove those Products first, or mark the category inactive.") :
        failure(error, "Could not confirm deletion. Refresh to check current data."));
    } finally { setBusy(false); }
  }

  const visible = items.filter((item) => !query.trim() || [item.name, item.slug, item.description ?? ""].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  function field(key: Exclude<keyof CategoryFormValues, "isActive">, label: string, textarea = false) {
    const id = `category-${key}`;
    const props = { id, value: form[key], disabled: busy, "aria-invalid": Boolean(errors[key]),
      "aria-describedby": errors[key] ? `category-error-${key}` : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm({ ...form, [key]: event.target.value }); setErrors({ ...errors, [key]: undefined }); } };
    return <div key={key}><label htmlFor={id} className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">{label}</label>
      {textarea ? <textarea {...props} className={textareaClass} /> : <input {...props} className={inputClass} />}
      {errors[key] ? <p className="mt-1 text-sm text-red-300" id={`category-error-${key}`}>{ar ? "تحقق من هذه القيمة وحاول مرة أخرى." : errors[key]}</p> : null}</div>;
  }

  return <section>
    <DashboardPageHeader eyebrow={ar ? "إدارة المنيو" : "Menu Control"} title={ar ? "الأقسام" : "Categories"} description={ar ? "نظّم أقسام منيو المطعم." : "Organize the real menu categories for this restaurant."}
      action={<ActionButton onClick={openCreate}><Plus aria-hidden="true" size={17} /> {ar ? "إضافة قسم" : "Add Category"}</ActionButton>} />
    <CatalogToast message={actionError || feedback} error={Boolean(actionError)} onClose={() => { setActionError(""); setFeedback(""); }} />
    <DashboardCard className="p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-[1fr_13rem]">
      <SearchInput value={query} onChange={setQuery} placeholder={ar ? "ابحث في أقسام هذه الصفحة..." : "Search this page of categories..."} />
      <select aria-label={ar ? "ترتيب الأقسام" : "Category sort"} className={`${inputClass} appearance-none`} value={sort} onChange={(event) => changeSort(event.target.value as CategorySort)}><option value="sortOrder">{ar ? "الترتيب ↑" : "Sort order ↑"}</option><option value="-sortOrder">{ar ? "الترتيب ↓" : "Sort order ↓"}</option></select>
    </div></DashboardCard>
    {loading ? <div role="status" aria-label={ar ? "جارٍ تحميل الأقسام" : "Loading categories"} className="mt-6 grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <DashboardCard className="h-72" key={index}><div className="h-full bg-white/[0.035]" /></DashboardCard>)}</div> :
      loadError ? <DashboardCard className="mt-6 p-6"><p role="alert" className="text-red-200">{ar ? "تعذر تحميل الأقسام. تحقق من الاتصال وحاول مرة أخرى." : loadError}</p><ActionButton className="mt-4" onClick={refresh}>{ar ? "إعادة المحاولة" : "Retry"}</ActionButton></DashboardCard> :
      pagination?.total === 0 ? <DashboardCard className="mt-6 p-8 text-center"><FolderOpen className="mx-auto text-[color:var(--primary-light)]" size={30} /><h3 className="mt-4 text-xl font-semibold">{ar ? "لا توجد أقسام بعد" : "No categories yet"}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{ar ? "أضف أول قسم لتنظيم المنيو." : "Create the first category to organize your menu."}</p><ActionButton className="mt-5" onClick={openCreate}>{ar ? "إضافة قسم" : "Add Category"}</ActionButton></DashboardCard> :
      visible.length === 0 ? <DashboardCard className="mt-6 p-6 text-center">{ar ? "لا توجد أقسام مطابقة في هذه الصفحة." : "No categories match on this page."}</DashboardCard> :
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map((category) => <article key={category.id} className="group overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.078),rgba(255,255,255,0.028)_60%,rgba(255,122,0,0.04))] shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
        <div className="relative aspect-[1.9] overflow-hidden"><CatalogImage key={`${category.id}:${category.imageUrl}`} alt={category.name} src={category.imageUrl} sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" /><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-black/15 to-black/10" /><div className="absolute start-4 top-4"><StatusBadge status={category.isActive ? "Active" : "Inactive"} /></div></div>
        <div className="p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-2xl font-semibold">{category.name}</h3><p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">{category.description || (ar ? "لا يوجد وصف" : "No description")}</p></div><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]"><FolderOpen aria-hidden="true" size={20} /></span></div>
          <p className="mt-4 text-xs text-[color:var(--text-muted)]">{ar ? "الترتيب:" : "Sort order:"} {category.sortOrder}{!category.isActive ? (ar ? " · لا يظهر في المنيو" : " · Hidden from public menu") : ""}</p>
          <div className="mt-5 flex flex-wrap gap-2"><ActionButton variant="ghost" className="min-h-10" disabled={busy || openingId !== null} onClick={() => void openEdit(category)}><Edit3 aria-hidden="true" size={15} />{openingId === category.id ? (ar ? "جارٍ الفتح…" : "Opening…") : (ar ? "تعديل" : "Edit")}</ActionButton><ActionButton variant="ghost" className="min-h-10" disabled={busy} onClick={() => void toggle(category)}>{category.isActive ? (ar ? "إيقاف" : "Deactivate") : (ar ? "تنشيط" : "Activate")}</ActionButton><ActionButton variant="danger" className="min-h-10" disabled={busy} onClick={() => { setDeleteTarget(category); setModalError(""); }}><Trash2 aria-hidden="true" size={15} />{ar ? "حذف" : "Delete"}</ActionButton></div>
        </div></article>)}</div>}
    {!loading && !loadError && pagination && pagination.total > limit ? <div className="mt-6 flex items-center justify-center gap-4"><ActionButton variant="ghost" disabled={page <= 1} onClick={() => changePage(page - 1)}>{ar ? "السابق" : "Previous"}</ActionButton><span className="text-sm text-[color:var(--text-muted)]">{ar ? `صفحة ${page} من ${Math.ceil(pagination.total / limit)}` : `Page ${page} of ${Math.ceil(pagination.total / limit)}`}</span><ActionButton variant="ghost" disabled={!pagination.hasNext} onClick={() => changePage(page + 1)}>{ar ? "التالي" : "Next"}</ActionButton></div> : null}
    <DashboardModal open={mode !== null} title={mode === "edit" ? (ar ? "تعديل القسم" : "Edit Category") : (ar ? "إضافة قسم" : "Add Category")} onClose={closeModal}><form noValidate className="grid gap-4" onSubmit={(event) => void save(event)}>
      {field("name", ar ? "اسم القسم" : "Category Name")}{field("description", ar ? "الوصف" : "Description", true)}{field("imageUrl", ar ? "رابط الصورة" : "Image URL")}{field("sortOrder", ar ? "الترتيب" : "Sort Order")}
      <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span><span className="block font-semibold">{ar ? "نشط" : "Active"}</span><span className="text-sm text-[color:var(--text-muted)]">{ar ? "الأقسام غير النشطة لا تظهر في المنيو." : "Inactive categories are hidden from the public menu."}</span></span><input type="checkbox" checked={form.isActive} disabled={busy} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="size-5 accent-[color:var(--primary)]" /></label>
      {modalError ? <p role="alert" className="text-sm text-red-200">{modalError}</p> : null}<div className="flex justify-end gap-3"><ActionButton variant="ghost" disabled={busy} onClick={closeModal}>{ar ? "إلغاء" : "Cancel"}</ActionButton><ActionButton type="submit" disabled={busy}>{busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ القسم" : "Save Category")}</ActionButton></div>
    </form></DashboardModal>
    <DashboardModal open={deleteTarget !== null} title={ar ? "حذف القسم" : "Delete Category"} onClose={closeModal}><p>{ar ? "هل تريد حذف " : "Delete "}<strong>{deleteTarget?.name}</strong>{ar ? "؟ لا يمكن التراجع عن الحذف." : "? This cannot be undone."}</p><p className="mt-2 text-sm text-[color:var(--text-muted)]">{ar ? "لا يمكن حذف قسم يحتوي على منتجات." : "Categories with Products cannot be deleted."}</p>{modalError ? <p role="alert" className="mt-4 text-sm text-red-200">{modalError}</p> : null}<div className="mt-6 flex justify-end gap-3"><ActionButton variant="ghost" disabled={busy} onClick={closeModal}>{ar ? "إلغاء" : "Cancel"}</ActionButton><ActionButton variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? (ar ? "جارٍ الحذف…" : "Deleting…") : (ar ? "حذف القسم" : "Delete Category")}</ActionButton></div></DashboardModal>
  </section>;
}
