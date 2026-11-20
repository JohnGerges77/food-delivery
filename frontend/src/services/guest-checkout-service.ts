import type { CartItem } from "@/types";
import { cartItemKey } from "../lib/cart-identity.ts";
import type { CheckoutDetails } from "@/components/features/checkout/checkout-details";

export type SubmissionMethod = "direct" | "whatsapp";
export type GuestCheckoutPayload = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  city: string;
  notes?: string;
  submissionMethod: SubmissionMethod;
  items: { productId: string; variantId?: string; quantity: number; notes?: string }[];
};
type BetaCheckoutPayload = { submissionMethod: "direct"; items: Omit<GuestCheckoutPayload["items"][number], "notes">[] };
type CheckoutSubmission = GuestCheckoutPayload | BetaCheckoutPayload;
export type CheckoutAvailability = "available" | "checkout-disabled" | "delivery-unavailable";

export function storefrontCheckoutAvailability(beta: boolean, checkoutEnabled: boolean, deliveryAvailable: boolean): CheckoutAvailability {
  if (!beta) return "available";
  if (!checkoutEnabled) return "checkout-disabled";
  return deliveryAvailable ? "available" : "delivery-unavailable";
}

export function checkoutUnavailableMessage(availability: CheckoutAvailability, arabic: boolean) {
  if (availability === "checkout-disabled") {
    return arabic ? "إرسال الطلبات متوقف حاليًا. يمكنك متابعة تصفح القائمة والاحتفاظ بسلتك."
      : "Ordering is paused. You can keep browsing and save your cart for later.";
  }
  if (availability === "delivery-unavailable") {
    return arabic ? "التوصيل غير متاح حاليًا، لذلك لا يمكن إرسال طلب. يمكنك الاحتفاظ بسلتك."
      : "Delivery is currently unavailable, so orders are paused. You can keep your cart for later.";
  }
  return "";
}
export type GuestCheckoutResult = {
  order: { orderNumber: string; status: "pending"; submissionMethod: SubmissionMethod;
    currency: string; subtotal: number; deliveryFee: number; total: number; savedInSavora: true };
  whatsapp?: { url: string; messageSent: false };
};
export type CheckoutField = keyof CheckoutDetails | "cart";
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export class GuestCheckoutError extends Error {
  readonly status: number | null;
  readonly uncertain: boolean;
  readonly paused: boolean;
  constructor(status: number | null, message: string, uncertain = false, paused = false) {
    super(message);
    this.name = "GuestCheckoutError";
    this.status = status;
    this.uncertain = uncertain;
    this.paused = paused;
  }
}

const invalidText = (value: string) => /[\x00-\x1f\x7f]/.test(value);
const objectId = /^[0-9a-fA-F]{24}$/;
const phonePattern = /^\+?[0-9][0-9 ()-]{6,28}$/;
function validateSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!slug || slug.length > 255 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new GuestCheckoutError(400, "Invalid restaurant address.");
  return slug;
}

export function checkoutValidation(details: CheckoutDetails, items: CartItem[]): CheckoutErrors {
  const errors: CheckoutErrors = {};
  for (const [field, limit] of [["fullName", 100], ["phone", 30], ["address", 240], ["city", 100]] as const) {
    const value = details[field];
    if (!value.trim() || value.length > limit || invalidText(value)) errors[field] = "required";
  }
  if (!errors.phone && !phonePattern.test(details.phone.trim())) errors.phone = "phone";
  if (details.notes.length > 500 || invalidText(details.notes)) errors.notes = "notes";
  if (invalidCart(items)) errors.cart = "cart";
  return errors;
}

export function invalidCart(items: CartItem[]) {
  if (!items.length || items.length > 10) return true;
  const ids = new Set<string>();
  let quantity = 0;
  for (const item of items) {
    const id = item.productId.toLowerCase();
    const identity = cartItemKey(item).toLowerCase();
    if (!objectId.test(id) || (item.variantId !== undefined && !objectId.test(item.variantId)) || ids.has(identity) || !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 || item.quantity > 99 ||
      (item.notes !== undefined && (item.notes.length > 200 || invalidText(item.notes)))) return true;
    ids.add(identity);
    quantity += item.quantity;
  }
  return quantity > 100;
}

export function buildBetaCheckoutPayload(items: CartItem[]): BetaCheckoutPayload {
  if (invalidCart(items)) throw new GuestCheckoutError(400, "Please check your cart.");
  return { submissionMethod: "direct", items: items.map(({ productId, quantity, variantId }) => ({
    productId: productId.toLowerCase(), quantity, ...(variantId ? { variantId: variantId.toLowerCase() } : {}),
  })) };
}

export function buildCheckoutPayload(details: CheckoutDetails, items: CartItem[], method: SubmissionMethod): GuestCheckoutPayload {
  if (Object.keys(checkoutValidation(details, items)).length) throw new GuestCheckoutError(400, "Please check your details and cart.");
  return {
    customerName: details.fullName.trim(), customerPhone: details.phone.trim(),
    deliveryAddress: details.address.trim(), city: details.city.trim(),
    ...(details.notes.trim() ? { notes: details.notes.trim() } : {}),
    submissionMethod: method,
    items: items.map((item) => ({ productId: item.productId.toLowerCase(), quantity: item.quantity,
      ...(item.variantId ? { variantId: item.variantId.toLowerCase() } : {}),
      ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}) })),
  };
}

function apiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL ||
    (typeof window === "undefined" ? process.env.SAVORA_INTERNAL_API_URL : "");
  if (typeof window !== "undefined" && !value) return "";
  if (!value) throw new GuestCheckoutError(null, "Checkout API is not configured.");
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw new GuestCheckoutError(null, "Checkout API URL is invalid."); }
}

function validateResult(value: unknown, method: SubmissionMethod): GuestCheckoutResult {
  if (!value || typeof value !== "object") throw new GuestCheckoutError(null, "Invalid checkout confirmation.", true);
  const result = value as GuestCheckoutResult;
  const order = result.order;
  if (!order || order.savedInSavora !== true || typeof order.orderNumber !== "string" ||
    !/^SV-[A-Za-z0-9]+$/.test(order.orderNumber) || order.status !== "pending" || order.submissionMethod !== method ||
    typeof order.currency !== "string" || !/^[A-Z]{3}$/.test(order.currency) ||
    ![order.subtotal, order.deliveryFee, order.total].every((amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0)) {
    throw new GuestCheckoutError(null, "Invalid checkout confirmation.", true);
  }
  if (method === "whatsapp") {
    try {
      const url = new URL(result.whatsapp?.url ?? "");
      if (url.protocol !== "https:" || url.hostname !== "wa.me" || url.username || url.password || url.port ||
        !/^\/[1-9][0-9]{6,14}$/.test(url.pathname) ||
        result.whatsapp?.messageSent !== false) throw new Error();
    } catch { throw new GuestCheckoutError(null, "Invalid WhatsApp handoff.", true); }
  }
  return result;
}

export async function submitGuestCheckout(slug: string, payload: CheckoutSubmission, key: string,
  fetcher: typeof fetch = fetch): Promise<GuestCheckoutResult> {
  const url = `${apiBaseUrl()}/api/public/restaurants/${encodeURIComponent(validateSlug(slug))}/orders`;
  let response: Response;
  try {
    response = await fetcher(url, { method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000) });
  } catch { throw new GuestCheckoutError(null, "The result is unknown. Retry with the same details to recover your order.", true); }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    const beta = !("customerName" in payload);
    const gateClosed = response.status === 503 && body?.error === "Checkout unavailable";
    const betaRequestBlocked = response.status === 403 && beta &&
      body?.error !== "Untrusted checkout origin";
    if (gateClosed || betaRequestBlocked) {
      throw new GuestCheckoutError(response.status, checkoutUnavailableMessage("checkout-disabled", false), false, true);
    }
    const unavailable = beta
      ? "Checkout is unavailable. Refresh the menu and check delivery, item availability, and the minimum order before trying again."
      : "Checkout is unavailable. Check delivery, minimum order, products, or WhatsApp availability.";
    const message = response.status === 401 || response.status === 403 ? "Checkout access was denied. Check preview access and retry." :
      response.status === 404 ? "This restaurant is unavailable." :
      response.status === 409 && body?.error === "Idempotency key conflict" ? "This retry conflicts with an earlier order. Review your details before trying again." :
      response.status === 409 ? unavailable :
      response.status === 400 ? "The server rejected these checkout details. Please review them." :
      response.status === 413 ? "The order details are too large." :
      response.status === 429 ? "Too many attempts. Please wait before retrying." :
      "The result is unknown. Retry with the same details to recover your order.";
    throw new GuestCheckoutError(response.status, message, response.status >= 500);
  }
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new GuestCheckoutError(null, "The result is unknown. Retry with the same details to recover your order.", true); }
  return validateResult(data, payload.submissionMethod);
}

type SavedAttempt = { slug: string; fingerprint: string; key: string };
const storagePrefix = "savora-checkout-attempt:";

async function fingerprint(payload: CheckoutSubmission) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class GuestCheckoutCoordinator {
  private active: Promise<GuestCheckoutResult> | null = null;
  private attempts = new Map<string, SavedAttempt & { payload: CheckoutSubmission }>();

  async submit(slug: string, payload: CheckoutSubmission, fetcher: typeof fetch = fetch,
    storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = typeof sessionStorage === "undefined" ? null : sessionStorage) {
    if (this.active) return this.active;
    const run = async () => {
      const safeSlug = validateSlug(slug);
      const hash = await fingerprint(payload);
      const storageKey = `${storagePrefix}${safeSlug}`;
      let saved: SavedAttempt[] = [];
      try {
        const parsed: unknown = JSON.parse(storage?.getItem(storageKey) ?? "null");
        saved = Array.isArray(parsed) ? parsed as SavedAttempt[] : parsed && typeof parsed === "object" ? [parsed as SavedAttempt] : [];
      } catch { /* storage may be unavailable */ }
      const mapKey = `${safeSlug}:${hash}`;
      const matching = this.attempts.get(mapKey);
      const stored = saved.find((entry) => entry?.slug === safeSlug && entry.fingerprint === hash &&
        typeof entry.key === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(entry.key));
      const key = matching?.key ?? stored?.key ?? crypto.randomUUID();
      const exactPayload = matching?.payload ?? payload;
      this.attempts.set(mapKey, { slug: safeSlug, fingerprint: hash, key, payload: exactPayload });
      saved = [...saved.filter((entry) => entry?.fingerprint !== hash), { slug: safeSlug, fingerprint: hash, key }];
      try { storage?.setItem(storageKey, JSON.stringify(saved)); } catch { /* in-memory retry remains available */ }
      const result = await submitGuestCheckout(safeSlug, exactPayload, key, fetcher);
      this.attempts.delete(mapKey);
      saved = saved.filter((entry) => entry.fingerprint !== hash);
      try {
        if (saved.length) storage?.setItem(storageKey, JSON.stringify(saved));
        else storage?.removeItem(storageKey);
      } catch { /* no customer data is stored */ }
      return result;
    };
    this.active = run();
    try { return await this.active; }
    finally { this.active = null; }
  }
}
