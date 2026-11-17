import type { CartItem } from "../types/order.ts";
import { cartItemKey } from "./cart-identity.ts";

export const CART_PREFIX = "savora-cart-v2:";
const LEGACY_KEY = "savora-cart-v1";
const MIGRATED_PREFIX = "savora-cart-migrated:";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const id = /^[a-f0-9]{24}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validItems(value: unknown): value is CartItem[] {
  if (!Array.isArray(value) || value.length > 100) return false;
  const keys = new Set<string>();
  return value.every((item) => {
    if (!item || typeof item !== "object" || typeof item.productId !== "string" || !id.test(item.productId) ||
      typeof item.name !== "string" || !item.name.trim() || item.name.length > 500 ||
      typeof item.image !== "string" || item.image.length > 4096 ||
      typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0 ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999 ||
      (item.variantId === undefined ? item.variantName !== undefined :
        typeof item.variantId !== "string" || !id.test(item.variantId) || typeof item.variantName !== "string" || !item.variantName.trim() || item.variantName.length > 500) ||
      (item.notes !== undefined && (typeof item.notes !== "string" || item.notes.length > 1000))) return false;
    const key = cartItemKey(item);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

function cleanItems(items: CartItem[]): CartItem[] {
  return items.map(({ productId, variantId, variantName, name, price, image, quantity, notes }) => ({
    productId, name, price, image, quantity,
    ...(variantId === undefined ? {} : { variantId, variantName }),
    ...(notes === undefined ? {} : { notes }),
  }));
}

export function parseCart(raw: string | null, slug: string, now = Date.now()): CartItem[] | null {
  if (!raw || !slugPattern.test(slug)) return null;
  try {
    const value = JSON.parse(raw);
    if (value.version !== 2 || value.tenantSlug !== slug || !Number.isSafeInteger(value.updatedAt) ||
      value.updatedAt > now || now - value.updatedAt > MAX_AGE || !validItems(value.items)) return null;
    return cleanItems(value.items);
  } catch { return null; }
}

export function saveCart(slug: string, items: CartItem[]): boolean {
  if (!slugPattern.test(slug) || !validItems(items)) return false;
  try {
    if (typeof localStorage === "undefined") return false;
    if (items.length) localStorage.setItem(CART_PREFIX + slug, JSON.stringify({ version: 2, tenantSlug: slug, updatedAt: Date.now(), items: cleanItems(items) }));
    localStorage.setItem(MIGRATED_PREFIX + slug, "1");
    if (!items.length) localStorage.removeItem(CART_PREFIX + slug);
    return true;
  } catch { return false; }
}

export function loadCart(slug: string): CartItem[] {
  if (!slugPattern.test(slug)) return [];
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(CART_PREFIX + slug);
    // An existing value, including an unknown future version, always wins over legacy data.
    if (raw !== null) return parseCart(raw, slug) ?? [];
    if (localStorage.getItem(MIGRATED_PREFIX + slug) !== null || typeof sessionStorage === "undefined") return [];
    const legacy = sessionStorage.getItem(LEGACY_KEY);
    if (!legacy) return [];
    const data = JSON.parse(legacy);
    if (data.version !== 1 || data.state?.tenantSlug !== slug || !validItems(data.state.items)) return [];
    const items = cleanItems(data.state.items);
    if (saveCart(slug, items)) {
      try { sessionStorage.removeItem(LEGACY_KEY); } catch { /* The persistent copy is already safe. */ }
    }
    return items;
  } catch { return []; }
}

export function discardLegacyCart(slug: string) {
  try {
    if (typeof sessionStorage === "undefined") return;
    const raw = sessionStorage.getItem(LEGACY_KEY);
    if (raw && JSON.parse(raw).state?.tenantSlug === slug) sessionStorage.removeItem(LEGACY_KEY);
  } catch { /* Storage is optional. */ }
}
