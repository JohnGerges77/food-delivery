"use client";

import { create } from "zustand";
import { CART_PREFIX, discardLegacyCart, loadCart, parseCart, saveCart } from "../lib/cart-persistence.ts";
import { cartItemKey } from "../lib/cart-identity.ts";
import type { CartItem, Product } from "@/types";
import type { PublicProduct } from "@/services/public-menu";

type CartState = {
  tenantSlug: string | null;
  items: CartItem[];
  addRevision: number;
  setTenant: (slug: string) => void;
  addPublicItem: (slug: string, product: PublicProduct, quantity?: number, variantId?: string) => void;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  increaseQuantity: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  clearCart: () => void;
  clearSubmittedCart: (slug: string, submitted: CartItem[]) => void;
  getSubtotal: () => number;
  getTotal: (deliveryFee: number) => number;
};

const memory = new Map<string, CartItem[]>();
let listening = false;
let receiving = false;

export const useCartStore = create<CartState>()((set, get) => ({
  tenantSlug: null,
  items: [],
  addRevision: 0,
  setTenant: (slug) => {
    if (typeof window !== "undefined" && !listening) {
      listening = true;
      window.addEventListener("storage", (event) => {
        if (!event.key?.startsWith(CART_PREFIX)) return;
        const slug = event.key.slice(CART_PREFIX.length);
        if (!memory.has(slug)) return;
        const current = get();
        try {
          if (event.storageArea !== localStorage || localStorage.getItem(event.key) !== event.newValue) return;
        } catch { return; }
        const items = event.newValue === null ? [] : parseCart(event.newValue, slug);
        if (items === null) return;
        memory.set(slug, items);
        if (current.tenantSlug !== slug) return;
        receiving = true;
        try { set({ items }); } finally { receiving = false; }
      });
    }
    if (get().tenantSlug === slug) return;
    const items = memory.get(slug) ?? loadCart(slug);
    memory.set(slug, items);
    set({ tenantSlug: slug, items });
  },
  addPublicItem: (slug, product, quantity = 1, variantId) => {
    if (get().tenantSlug !== slug) get().setTenant(slug);
    set((state) => {
      const variant = product.variants?.find((v) => v.id === variantId && v.isAvailable);
      if (product.variants?.length ? !variant : variantId !== undefined) return state;
      if (!Number.isSafeInteger(quantity) || quantity < 1 ||
          !/^[0-9a-fA-F]{24}$/.test(product.id)) return state;
      const items = state.tenantSlug === slug ? state.items : [];
      const safeQuantity = quantity;
      const key = cartItemKey({ productId: product.id, variantId });
      const existing = items.find((item) => cartItemKey(item) === key);
      return { tenantSlug: slug, addRevision: state.addRevision + 1, items: existing
        ? items.map((item) => cartItemKey(item) === key ? { ...item, quantity: item.quantity + safeQuantity } : item)
        : [...items, { productId: product.id, name: product.name, price: variant?.price ?? product.price,
          ...(variant ? { variantId: variant.id, variantName: variant.name } : {}),
          image: product.imageUrl ?? "", quantity: safeQuantity }] };
    });
  },
  addItem: (product, quantity = 1) =>
    set((state) => {
      const existingItem = state.items.find((item) => item.productId === product.id);
      const safeQuantity = Math.max(1, quantity);

      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + safeQuantity }
              : item,
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: safeQuantity,
          },
        ],
      };
    }),
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => cartItemKey(item) !== productId),
    })),
  increaseQuantity: (productId) =>
    set((state) => ({
      items: state.items.map((item) =>
        cartItemKey(item) === productId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    })),
  decreaseQuantity: (productId) =>
    set((state) => ({
      items: state.items
        .map((item) =>
          cartItemKey(item) === productId
            ? { ...item, quantity: Math.max(0, item.quantity - 1) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    })),
  clearCart: () => { const slug = get().tenantSlug; if (slug) discardLegacyCart(slug); set({ items: [] }); },
  clearSubmittedCart: (slug, submitted) => {
    const current = get();
    const items = current.tenantSlug === slug ? current.items : memory.get(slug);
    const signature = (lines: CartItem[]) => JSON.stringify(lines.map((item) => [item.productId, item.variantId, item.quantity, item.notes]));
    if (!items || signature(items) !== signature(submitted)) return;
    if (current.tenantSlug === slug) current.clearCart();
    else { memory.set(slug, []); discardLegacyCart(slug); saveCart(slug, []); }
  },
  getSubtotal: () =>
    get().items.reduce((total, item) => total + item.price * item.quantity, 0),
  getTotal: (deliveryFee) => get().getSubtotal() + deliveryFee,
}));

// Persist only cart mutations, never initial empty state or tenant hydration.
useCartStore.subscribe((state, previous) => {
  if (receiving || !state.tenantSlug || state.items === previous.items) return;
  if (state.tenantSlug !== previous.tenantSlug) return;
  memory.set(state.tenantSlug, state.items);
  saveCart(state.tenantSlug, state.items);
});
