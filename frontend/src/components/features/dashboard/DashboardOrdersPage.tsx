"use client";

import { Eye, MapPin, Phone, RefreshCw, ShoppingBag } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/services/api-client";
import { getOwnerOrder, listOwnerOrders, nextOrderStatuses, visibleOrderStatuses, operationalOrderStatus,
  ownerOrderDate, ownerOrderMethodLabel, ownerOrderMoney, ownerOrderStatusLabel,
  patchOwnerOrderStatus, validateOwnerOrderFilters,
  type OwnerOrder, type OwnerOrderMethod, type OwnerOrderStatus, type OwnerOrderStatusGroup } from "@/services/owner-orders-service";
import type { OwnerPagination } from "@/services/owner-catalog-common";
import { useAuthStore } from "@/store/auth-store";
import { CatalogImage } from "./CatalogImage";
import {
  ActionButton,
  DashboardCard,
  DashboardModal,
  SearchInput,
  StatusBadge,
  inputClass,
} from "./DashboardUI";

const statusFlow: OwnerOrderStatusGroup[] = ["pending", "delivered"];
const limit = 20;

function itemCount(order: OwnerOrder) {
  return order.items.reduce((count, item) => count + item.quantity, 0);
}

export function DashboardOrdersPage() {
  const context = useAuthStore((state) => state.context);
  if (!context) return null;
  return <OwnerOrdersView key={`${context.user.id}:${context.restaurant.id}`} currency={context.restaurant.currency} />;
}

function OwnerOrdersView({ currency }: { currency: string }) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const restore = useAuthStore((state) => state.restore);
  const [items, setItems] = useState<OwnerOrder[]>([]);
  const [pagination, setPagination] = useState<OwnerPagination | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"all" | OwnerOrderStatusGroup>("all");
  const [query, setQuery] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [method, setMethod] = useState<"all" | OwnerOrderMethod>("all");
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [filterError, setFilterError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OwnerOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<OwnerOrderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const detailRequest = useRef(0);
  const listKey = JSON.stringify({ page, activeTab, method, orderNumber, dateRange });
  const pageReady = loadedKey === listKey;
  const visibleOrders = pageReady ? items : [];
  const visiblePagination = pageReady ? pagination : null;
  const price = (amount: number) => ownerOrderMoney(amount, currency, locale);
  const label = (status: OwnerOrderStatus) => ownerOrderStatusLabel(status, locale);

  useEffect(() => {
    let cancelled = false;
    void listOwnerOrders({ page, limit, statusGroup: activeTab === "all" ? undefined : activeTab,
      submissionMethod: method === "all" ? undefined : method, orderNumber: orderNumber || undefined,
      from: dateRange.from || undefined, to: dateRange.to || undefined }).then((result) => {
      if (cancelled) return;
      if (page > 1 && result.orders.length === 0) {
        setPage(Math.max(1, Math.ceil(result.pagination.total / limit)));
        return;
      }
      setItems(result.orders); setPagination(result.pagination); setLoadedKey(listKey); setLoading(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof ApiError && error.status === 401) { void restore(); return; }
      setLoadError(isArabic ? "تعذر تحميل الطلبات. حاول مجددًا." : "Could not load orders. Retry or refresh.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [listKey, page, activeTab, method, orderNumber, dateRange, revision, restore, isArabic]);

  function refresh() { setLoading(true); setLoadError(""); setRevision((value) => value + 1); }
  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    const error = validateOwnerOrderFilters({ orderNumber: value || undefined });
    setFilterError(error ?? "");
    if (!error) { setLoadError(""); setPage(1); setOrderNumber(value); }
  }
  function applyDates() {
    const error = validateOwnerOrderFilters({ from: fromDraft || undefined, to: toDraft || undefined });
    setFilterError(error ?? "");
    if (!error) { setLoadError(""); setPage(1); setDateRange({ from: fromDraft, to: toDraft }); }
  }
  function resetFilters() {
    setQuery(""); setOrderNumber(""); setActiveTab("all"); setMethod("all");
    setFromDraft(""); setToDraft(""); setDateRange({ from: "", to: "" });
    setFilterError(""); setLoadError(""); setPage(1);
  }
  async function openOrder(id: string, desiredStatus?: OwnerOrderStatus) {
    const request = ++detailRequest.current;
    setSelectedId(id); setSelectedOrder(null); setDetailLoading(true); setDetailError("");
    setPendingStatus(null); setActionError("");
    try {
      const order = await getOwnerOrder(id);
      if (request !== detailRequest.current) return;
      setSelectedOrder(order);
      if (desiredStatus) {
        if (nextOrderStatuses(order.status).includes(desiredStatus)) setPendingStatus(desiredStatus);
        else setActionError(isArabic ? "تغيّرت حالة الطلب. راجع الحالة الحالية." : "This order changed. Review its current status.");
      }
    } catch (error) {
      if (request !== detailRequest.current) return;
      if (error instanceof ApiError && error.status === 401) { void restore(); return; }
      setDetailError(isArabic ? "تعذر عرض هذا الطلب. قد لا يكون متاحًا الآن." : "This order could not be opened. It may no longer be available.");
    } finally { if (request === detailRequest.current) setDetailLoading(false); }
  }
  function closeOrder() {
    if (busy) return;
    detailRequest.current += 1;
    setSelectedId(null); setSelectedOrder(null); setPendingStatus(null); setActionError("");
  }
  async function confirmStatus() {
    if (!selectedOrder || !pendingStatus || busy || !nextOrderStatuses(selectedOrder.status).includes(pendingStatus)) return;
    const id = selectedOrder.id;
    const status = pendingStatus;
    setBusy(true); setActionError(""); setFeedback("");
    try {
      const order = await patchOwnerOrderStatus(id, status);
      setSelectedOrder(order);
      setItems((current) => current.map((entry) => entry.id === id ? order : entry));
      setPendingStatus(null);
      setFeedback(isArabic ? `تم تحديث الطلب ${order.orderNumber}.` : `Order ${order.orderNumber} updated.`);
      refresh();
    } catch (error) {
      setPendingStatus(null);
      if (error instanceof ApiError && error.status === 401) { void restore(); return; }
      if (error instanceof ApiError && error.status === 409) {
        setActionError(isArabic ? "تغيّرت حالة الطلب على الخادم. تم تحميل أحدث حالة؛ راجع الإجراءات المتاحة." : "The order changed on the server. Review its current status and available actions.");
      } else if (error instanceof ApiError && error.status === 403) {
        setActionError(isArabic ? "رُفض التحديث. تحقق من إعدادات الجلسة وCSRF ثم حاول مجددًا." : "Update rejected. Check the owner session and CSRF configuration.");
      } else {
        setActionError(isArabic ? "تعذر تأكيد التحديث. راجع الحالة الحالية قبل المحاولة مرة أخرى." : "Could not confirm the update. Review the current status before trying again.");
      }
      try { setSelectedOrder(await getOwnerOrder(id)); }
      catch (detailFailure) {
        setSelectedOrder(null);
        if (detailFailure instanceof ApiError && detailFailure.status === 401) void restore();
        else setDetailError(isArabic ? "تعذر تحديث تفاصيل الطلب." : "Could not refresh order details.");
      }
      refresh();
    } finally { setBusy(false); }
  }

  return (
    <section>
      <DashboardCard className="p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <form className="flex flex-wrap gap-2" onSubmit={applySearch}>
            <div className="min-w-48 flex-1"><SearchInput value={query} onChange={(value) => {
              setQuery(value); setFilterError("");
              if (!value && orderNumber) { setOrderNumber(""); setPage(1); }
            }} placeholder={isArabic ? "رقم الطلب الكامل فقط" : "Exact order number only"} /></div>
            <ActionButton type="submit" variant="ghost">{isArabic ? "بحث" : "Find"}</ActionButton>
          </form>
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(["all", ...visibleOrderStatuses] as const).map((tab) => (
              <button
                className={`h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--background)] shadow-[0_14px_34px_rgba(255,122,0,0.28)]"
                    : "border-white/10 bg-white/[0.035] text-[color:var(--text-muted)] hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
                }`}
                key={tab}
                onClick={() => { setLoadError(""); setPage(1); setActiveTab(tab); }}
                type="button"
              >
                {tab === "all" ? (isArabic ? "كل الطلبات" : "All Orders") : label(tab)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/10 pt-4 text-sm">
          <label className="min-w-36 flex-1 text-[color:var(--text-muted)]">{isArabic ? "طريقة الطلب" : "Method"}
            <select className={`${inputClass} mt-2 appearance-none`} value={method} onChange={(event) => { setLoadError(""); setPage(1); setMethod(event.target.value as "all" | OwnerOrderMethod); }}>
              <option value="all">{isArabic ? "كل الطرق" : "All methods"}</option><option value="direct">{ownerOrderMethodLabel("direct", locale)}</option><option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <label className="min-w-36 flex-1 text-[color:var(--text-muted)]">{isArabic ? "من (UTC)" : "From (UTC)"}<input className={`${inputClass} mt-2`} type="date" value={fromDraft} onChange={(event) => setFromDraft(event.target.value)} /></label>
          <label className="min-w-36 flex-1 text-[color:var(--text-muted)]">{isArabic ? "إلى (UTC)" : "To (UTC)"}<input className={`${inputClass} mt-2`} type="date" value={toDraft} onChange={(event) => setToDraft(event.target.value)} /></label>
          <ActionButton variant="ghost" onClick={applyDates}>{isArabic ? "تطبيق التاريخ" : "Apply Dates"}</ActionButton>
          <ActionButton variant="ghost" onClick={resetFilters}>{isArabic ? "مسح الفلاتر" : "Reset"}</ActionButton>
          <ActionButton variant="ghost" onClick={refresh} disabled={loading}><RefreshCw aria-hidden="true" size={16} />{isArabic ? "تحديث" : "Refresh"}</ActionButton>
        </div>
        {filterError ? <p className="mt-3 text-sm text-red-200" role="alert">{isArabic ? "راجع رقم الطلب أو نطاق التاريخ المُدخل." : filterError}</p> : null}
      </DashboardCard>

      {feedback ? <p className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100" role="status">{feedback}</p> : null}
      {loadError ? <div className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{loadError}<ActionButton className="ml-3" variant="ghost" onClick={refresh}>{isArabic ? "إعادة المحاولة" : "Retry"}</ActionButton></div> : null}
      {!pageReady && !loadError ? <div className="mt-6 grid gap-4" aria-label={isArabic ? "جارٍ تحميل الطلبات" : "Loading orders"}>{Array.from({ length: 3 }, (_, index) => <DashboardCard className="h-32 animate-pulse bg-white/[0.04]" key={index}><span className="sr-only">{isArabic ? "جارٍ التحميل" : "Loading"}</span></DashboardCard>)}</div> : null}
      {!loading && !loadError && pageReady && visiblePagination?.total === 0 ? <DashboardCard className="mt-6 p-8 text-center"><ShoppingBag className="mx-auto text-[color:var(--primary-light)]" size={32} /><h3 className="mt-4 text-xl font-semibold">{isArabic ? "لا توجد طلبات مطابقة" : "No matching orders"}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{isArabic ? "يمكنك تحديث القائمة أو تعديل الفلاتر." : "Refresh the list or adjust the filters."}</p></DashboardCard> : null}
      {pageReady && visiblePagination && visiblePagination.total > 0 ? <p className="mt-5 text-sm text-[color:var(--text-muted)]" role="status">{isArabic ? `${visiblePagination.total} طلب مطابق · صفحة ${visiblePagination.page}` : `${visiblePagination.total} matching orders · page ${visiblePagination.page}`}{loading ? (isArabic ? " · جارٍ التحديث" : " · refreshing") : ""}</p> : null}
      <div className="mt-6 grid gap-4" data-testid="owner-orders-list">
        {visibleOrders.map((order) => (
          <article
            className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.078),rgba(255,255,255,0.028)_60%,rgba(255,122,0,0.04))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl"
            key={order.id}
          >
            <div className="grid gap-4 xl:grid-cols-[0.75fr_1fr_0.5fr_0.65fr_0.8fr_auto] xl:items-center">
              <div>
                <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  {order.orderNumber}
                </div>
                <div className="mt-2 text-xl font-semibold">{order.customerName}</div>
                <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                  {ownerOrderDate(order.createdAt, locale)}
                </div>
                <div className="mt-1 text-xs font-semibold text-[color:var(--gold)]">{ownerOrderMethodLabel(order.submissionMethod, locale)}</div>
              </div>

              <div className="grid gap-2 text-sm text-[color:var(--text-muted)]">
                <span className="flex items-start gap-2">
                  <Phone className="mt-0.5 shrink-0 text-[color:var(--primary-light)]" size={15} />
                  {order.customerPhone}
                </span>
                <span className="flex items-start gap-2">
                  <MapPin className="mt-0.5 shrink-0 text-[color:var(--primary-light)]" size={15} />
                  {order.deliveryAddress}, {order.city}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <ShoppingBag className="text-[color:var(--primary-light)]" size={16} />
                <span>{itemCount(order)} {isArabic ? "عنصر" : "items"}</span>
              </div>

              <div className="text-xl font-semibold text-[color:var(--primary-light)]">
                {price(order.total)}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={operationalOrderStatus(order.status)} label={label(order.status)} />
                {nextOrderStatuses(order.status).length > 0 ? <div className="flex flex-wrap gap-2">
                  <ActionButton disabled={busy} onClick={() => void openOrder(order.id, "delivered")}>{isArabic ? "تم التسليم" : "Mark as Delivered"}</ActionButton>
                  <ActionButton variant="danger" disabled={busy} onClick={() => void openOrder(order.id, "cancelled")}>{isArabic ? "إلغاء الطلب" : "Cancel Order"}</ActionButton>
                </div> : null}
              </div>

              <ActionButton variant="ghost" onClick={() => void openOrder(order.id)}>
                <Eye aria-hidden="true" size={15} />
                {isArabic ? "عرض" : "View"}
              </ActionButton>
            </div>
          </article>
        ))}
      </div>

      {visiblePagination && visiblePagination.total > 0 ? <div className="mt-6 flex flex-wrap items-center justify-center gap-4"><ActionButton variant="ghost" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>{isArabic ? "السابق" : "Previous"}</ActionButton><span className="text-sm text-[color:var(--text-muted)]">{isArabic ? `صفحة ${page} من ${Math.max(1, Math.ceil(visiblePagination.total / limit))}` : `Page ${page} of ${Math.max(1, Math.ceil(visiblePagination.total / limit))}`}</span><ActionButton variant="ghost" disabled={loading || !visiblePagination.hasNext || page >= 1000} onClick={() => setPage(page + 1)}>{isArabic ? "التالي" : "Next"}</ActionButton></div> : null}

      <DashboardModal
        open={Boolean(selectedId)}
        title={selectedOrder ? `${isArabic ? "طلب" : "Order"} ${selectedOrder.orderNumber}` : isArabic ? "تفاصيل الطلب" : "Order Details"}
        onClose={closeOrder}
      >
          {detailLoading ? <div className="grid gap-3" aria-label={isArabic ? "جارٍ تحميل التفاصيل" : "Loading order details"}><div className="h-24 animate-pulse rounded-2xl bg-white/[0.06]" /><div className="h-24 animate-pulse rounded-2xl bg-white/[0.06]" /></div> : null}
          {detailError ? <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{detailError}<ActionButton className="ml-2" variant="ghost" onClick={() => selectedId && void openOrder(selectedId)}>{isArabic ? "إعادة المحاولة" : "Retry"}</ActionButton></p> : null}
          {selectedOrder ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--text-muted)]"><StatusBadge status={operationalOrderStatus(selectedOrder.status)} label={label(selectedOrder.status)} /><span>{ownerOrderMethodLabel(selectedOrder.submissionMethod, locale)}</span><span>{ownerOrderDate(selectedOrder.createdAt, locale)}</span></div>
              {actionError ? <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100" role="alert">{actionError}</p> : null}
              {pendingStatus ? <div className="rounded-2xl border border-[color:var(--primary)]/35 bg-[color:var(--primary)]/10 p-4" data-testid="status-confirmation"><p className="text-sm leading-6">{isArabic ? `تأكيد تغيير حالة ${selectedOrder.orderNumber} إلى ${label(pendingStatus)}؟` : `Change ${selectedOrder.orderNumber} to ${label(pendingStatus)}?`}{pendingStatus === "cancelled" ? (isArabic ? " الإلغاء نهائي." : " Cancellation is final.") : pendingStatus === "delivered" ? (isArabic ? " التوصيل نهائي ولا يعني تأكيد الدفع." : " Delivery is final and does not confirm payment.") : ""}</p><div className="mt-4 flex flex-wrap gap-2"><ActionButton variant="ghost" disabled={busy} onClick={() => setPendingStatus(null)}>{isArabic ? "رجوع" : "Back"}</ActionButton><ActionButton variant={pendingStatus === "cancelled" ? "danger" : "primary"} disabled={busy} onClick={() => void confirmStatus()}>{busy ? (isArabic ? "جارٍ الحفظ" : "Saving") : isArabic ? "تأكيد الحالة" : "Confirm Status"}</ActionButton></div></div> : null}
              <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    {isArabic ? "العميل" : "Customer"}
                  </div>
                  <div className="mt-2 font-semibold">{selectedOrder.customerName}</div>
                  <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                    {selectedOrder.customerPhone}
                  </div>
                  {selectedOrder.customerEmail ? <div className="mt-1 break-all text-sm text-[color:var(--text-muted)]">{selectedOrder.customerEmail}</div> : null}
                </div>
                <div>
                  <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    {isArabic ? "عنوان التوصيل" : "Delivery Address"}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                    {selectedOrder.deliveryAddress}, {selectedOrder.city}
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {selectedOrder.items.map((item) => (
                  <div
                    className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                    key={`${selectedOrder.id}-${item.productId}`}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-xl">
                      <CatalogImage alt={item.name} src={item.imageUrl} sizes="4rem" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{item.name}</div>
                      <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                        {isArabic ? "الكمية" : "Qty"} {item.quantity} × {price(item.unitPrice)}
                      </div>
                      {item.notes ? <div className="mt-1 text-xs text-[color:var(--text-muted)]">{item.notes}</div> : null}
                    </div>
                    <div className="font-semibold text-[color:var(--primary-light)]">
                      {price(item.unitPrice * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  {isArabic ? "ملاحظات" : "Notes"}
                </div>
                <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                  {selectedOrder.notes || (isArabic ? "لا توجد ملاحظات إضافية." : "No special notes.")}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="mb-4 text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    {isArabic ? "مراحل الطلب" : "Status Timeline"}
                  </div>
                  <div className="grid gap-3">
                    {statusFlow.map((status) => {
                      const activeIndex = statusFlow.indexOf(operationalOrderStatus(selectedOrder.status));
                      const currentIndex = statusFlow.indexOf(status);
                      const isActive = currentIndex <= activeIndex && activeIndex >= 0;

                      return (
                        <div className="flex items-center gap-3" key={status}>
                          <span
                            className={`size-3 rounded-full ${
                              isActive
                                ? "bg-[color:var(--primary)] shadow-[0_0_18px_rgba(255,122,0,0.7)]"
                                : "bg-white/15"
                            }`}
                          />
                          <span className={isActive ? "text-[color:var(--text)]" : "text-[color:var(--text-muted)]"}>
                            {label(status)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {selectedOrder.status === "cancelled" ? <p className="mt-3 text-sm text-red-200">{label("cancelled")}</p> : null}
                  {selectedOrder.deliveredAt ? <p className="mt-3 text-xs text-[color:var(--text-muted)]">{isArabic ? "وقت التوصيل" : "Delivered"}: {ownerOrderDate(selectedOrder.deliveredAt, locale)}</p> : null}
                  {nextOrderStatuses(selectedOrder.status).length ? <div className="mt-4 flex flex-wrap gap-2">{nextOrderStatuses(selectedOrder.status).map((status) => <ActionButton className="px-4" variant={status === "cancelled" ? "danger" : "primary"} disabled={busy} key={status} onClick={() => setPendingStatus(status)}>{status === "delivered" ? (isArabic ? "تم التسليم" : "Mark as Delivered") : (isArabic ? "إلغاء الطلب" : "Cancel Order")}</ActionButton>)}</div> : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="mb-4 text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    {isArabic ? "الإجمالي" : "Total"}
                  </div>
                  <div className="grid gap-3 text-sm text-[color:var(--text-muted)]">
                    <div className="flex justify-between">
                      <span>{isArabic ? "المجموع الفرعي" : "Subtotal"}</span>
                      <span>{price(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isArabic ? "رسوم التوصيل" : "Delivery fee"}</span>
                      <span>{price(selectedOrder.deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-3 text-lg font-semibold text-[color:var(--text)]">
                      <span>{isArabic ? "الإجمالي" : "Total"}</span>
                      <span className="text-[color:var(--primary-light)]">
                        {price(selectedOrder.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
      </DashboardModal>
    </section>
  );
}
