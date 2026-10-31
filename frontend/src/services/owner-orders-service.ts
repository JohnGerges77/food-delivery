import { ApiError, apiRequest } from "./api-client.ts";
import { isObjectId, isRecord, parsePagination, type OwnerPagination } from "./owner-catalog-common.ts";

export type OwnerOrderStatus = "pending" | "preparing" | "ready" | "out-for-delivery" | "delivered" | "cancelled";
export type OwnerOrderStatusGroup = "pending" | "delivered" | "cancelled";
export type OwnerOrderMethod = "direct" | "whatsapp";
export interface OwnerOrderItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  notes: string | null;
}
export interface OwnerOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string;
  city: string;
  items: OwnerOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OwnerOrderStatus;
  source: "website";
  submissionMethod: OwnerOrderMethod;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
}
export interface OwnerOrderFilters {
  page?: number;
  limit?: number;
  status?: OwnerOrderStatus;
  statusGroup?: OwnerOrderStatusGroup;
  submissionMethod?: OwnerOrderMethod;
  orderNumber?: string;
  from?: string;
  to?: string;
}

export const orderStatuses: OwnerOrderStatus[] = ["pending", "preparing", "ready", "out-for-delivery", "delivered", "cancelled"];
export const visibleOrderStatuses: OwnerOrderStatusGroup[] = ["pending", "delivered", "cancelled"];
const transitions: Record<OwnerOrderStatus, OwnerOrderStatus[]> = {
  pending: ["delivered", "cancelled"],
  preparing: ["delivered", "cancelled"],
  ready: ["delivered", "cancelled"],
  "out-for-delivery": ["delivered", "cancelled"],
  delivered: [], cancelled: [],
};
export const nextOrderStatuses = (status: OwnerOrderStatus) => transitions[status];

export const operationalOrderStatus = (status: OwnerOrderStatus): OwnerOrderStatusGroup =>
  status === "delivered" || status === "cancelled" ? status : "pending";

export function ownerOrderStatusLabel(status: OwnerOrderStatus, locale: string) {
  status = operationalOrderStatus(status);
  const labels = locale === "ar" ? {
    pending: "قيد الانتظار", preparing: "قيد التحضير", ready: "جاهز", "out-for-delivery": "خرج للتوصيل",
    delivered: "تم التسليم", cancelled: "ملغي",
  } : {
    pending: "Pending", preparing: "Preparing", ready: "Ready", "out-for-delivery": "Out for Delivery",
    delivered: "Delivered", cancelled: "Cancelled",
  };
  return labels[status];
}
export function ownerOrderMethodLabel(method: OwnerOrderMethod, locale: string) {
  return method === "whatsapp" ? "WhatsApp" : locale === "ar" ? "مباشر" : "Direct";
}
export function ownerOrderMoney(value: number, currency: string, locale: string) {
  try { return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "currency", currency }).format(value); }
  catch { return `${value} ${currency}`; }
}
export function ownerOrderDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateOwnerOrderFilters(filters: OwnerOrderFilters): string | null {
  if (filters.page !== undefined && (!Number.isInteger(filters.page) || filters.page < 1 || filters.page > 1000)) return "Invalid page";
  if (filters.limit !== undefined && (!Number.isInteger(filters.limit) || filters.limit < 1 || filters.limit > 100)) return "Invalid page size";
  if (filters.status !== undefined && !orderStatuses.includes(filters.status)) return "Invalid status";
  if (filters.statusGroup !== undefined && !visibleOrderStatuses.includes(filters.statusGroup)) return "Invalid status group";
  if (filters.status !== undefined && filters.statusGroup !== undefined) return "Choose one status filter";
  if (filters.submissionMethod !== undefined && !["direct", "whatsapp"].includes(filters.submissionMethod)) return "Invalid method";
  if (filters.orderNumber !== undefined && !/^[A-Za-z0-9-]{1,100}$/.test(filters.orderNumber)) return "Enter one exact order number (letters, numbers and hyphens only).";
  if (filters.from !== undefined && !validDate(filters.from)) return "Enter a valid From date.";
  if (filters.to !== undefined && !validDate(filters.to)) return "Enter a valid To date.";
  if (filters.from && filters.to && filters.from > filters.to) return "From date must be before or equal to To date.";
  return null;
}

function serverError(): never { throw new ApiError(null, "Invalid server response"); }
function text(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function nullableText(value: unknown): value is string | null { return value === null || typeof value === "string"; }
function money(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function timestamp(value: unknown): value is string { return text(value) && Number.isFinite(Date.parse(value)); }

export function parseOwnerOrder(value: unknown): OwnerOrder {
  if (!isRecord(value) || !text(value.id) || !isObjectId(value.id) || !text(value.orderNumber) ||
    !text(value.customerName) || !text(value.customerPhone) || !nullableText(value.customerEmail) ||
    !text(value.deliveryAddress) || !text(value.city) || !Array.isArray(value.items) ||
    !value.items.length || !money(value.subtotal) || !money(value.deliveryFee) || !money(value.total) ||
    !orderStatuses.includes(value.status as OwnerOrderStatus) || value.source !== "website" ||
    !["direct", "whatsapp"].includes(value.submissionMethod as string) || !nullableText(value.notes) ||
    !timestamp(value.createdAt) || !timestamp(value.updatedAt) ||
    !(value.deliveredAt === null || timestamp(value.deliveredAt))) serverError();
  for (const item of value.items) {
    if (!isRecord(item) || !text(item.productId) || !isObjectId(item.productId) || !text(item.name) ||
      !money(item.unitPrice) || !Number.isSafeInteger(item.quantity) || (item.quantity as number) < 1 ||
      !nullableText(item.imageUrl) || !nullableText(item.notes)) serverError();
  }
  const order = value as unknown as OwnerOrder;
  return {
    id: order.id, orderNumber: order.orderNumber, customerName: order.customerName,
    customerPhone: order.customerPhone, customerEmail: order.customerEmail,
    deliveryAddress: order.deliveryAddress, city: order.city,
    items: order.items.map((item) => ({ productId: item.productId, name: item.name,
      unitPrice: item.unitPrice, quantity: item.quantity, imageUrl: item.imageUrl, notes: item.notes })),
    subtotal: order.subtotal, deliveryFee: order.deliveryFee, total: order.total,
    status: order.status, source: order.source, submissionMethod: order.submissionMethod,
    notes: order.notes, createdAt: order.createdAt, updatedAt: order.updatedAt,
    deliveredAt: order.deliveredAt,
  };
}

function parseOne(value: unknown): OwnerOrder {
  if (!isRecord(value)) serverError();
  return parseOwnerOrder(value.order);
}

export async function listOwnerOrders(filters: OwnerOrderFilters = {}): Promise<{ orders: OwnerOrder[]; pagination: OwnerPagination }> {
  const options = { page: 1, limit: 20, ...filters };
  const error = validateOwnerOrderFilters(options);
  if (error) throw new ApiError(400, error);
  const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit) });
  for (const key of ["status", "statusGroup", "submissionMethod", "orderNumber", "from", "to"] as const) {
    if (options[key] !== undefined) params.set(key, options[key]);
  }
  const result = await apiRequest<unknown>(`/api/owner/orders?${params}`);
  if (!isRecord(result) || !Array.isArray(result.orders)) serverError();
  const pagination = parsePagination(result.pagination);
  if (pagination.page !== options.page || pagination.limit !== options.limit || result.orders.length > options.limit) serverError();
  return { orders: result.orders.map(parseOwnerOrder), pagination };
}

export async function getOwnerOrder(id: string): Promise<OwnerOrder> {
  if (!isObjectId(id)) throw new ApiError(404, "Order unavailable");
  return parseOne(await apiRequest<unknown>(`/api/owner/orders/${encodeURIComponent(id)}`));
}

export async function patchOwnerOrderStatus(id: string, status: OwnerOrderStatus): Promise<OwnerOrder> {
  if (!isObjectId(id) || !["delivered", "cancelled"].includes(status)) throw new ApiError(400, "Invalid status update");
  return parseOne(await apiRequest<unknown>(`/api/owner/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH", body: { status }, csrf: "session",
  }));
}
