"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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
  getSubtotal: () => number;
  getTotal: (deliveryFee: number) => number;
};

export const useCartStore = create<CartState>()(persist((set, get) => ({
  tenantSlug: null,
  items: [],
  addRevision: 0,
  setTenant: (slug) => set((state) => state.tenantSlug === slug ? state : { tenantSlug: slug, items: [] }),
  addPublicItem: (slug, product, quantity = 1, variantId) => set((state) => {
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
  }),
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
  clearCart: () => set({ items: [] }),
  getSubtotal: () =>
    get().items.reduce((total, item) => total + item.price * item.quantity, 0),
  getTotal: (deliveryFee) => get().getSubtotal() + deliveryFee,
}), { name: 'savora-cart-v1', version: 1, storage: createJSONStorage(() => ({
  getItem: (key) => { try { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key); } catch { return null; } },
  setItem: (key,value) => { try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key,value); } catch { /* memory remains available */ } },
  removeItem: (key) => { try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key); } catch { /* storage unavailable */ } },
})),
  skipHydration: true,
  merge: (saved, current) => {
    const data = saved as { tenantSlug?: unknown; items?: unknown } | undefined;
    if (!data || typeof data.tenantSlug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.tenantSlug) || !Array.isArray(data.items) || data.items.length > 10) return current;
    const items = data.items.filter((item) => item && typeof item === 'object' && typeof item.productId === 'string' && /^[a-f0-9]{24}$/i.test(item.productId) && (item.variantId === undefined || (typeof item.variantId === 'string' && /^[a-f0-9]{24}$/i.test(item.variantId))) && typeof item.name === 'string' && typeof item.image === 'string' && Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99 && typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0);
    const safeItems = items.filter((item) => (item.variantId === undefined ? item.variantName === undefined : typeof item.variantName === 'string') && (item.notes === undefined || typeof item.notes === 'string'));
    return { ...current, tenantSlug: data.tenantSlug, items: safeItems };
  },
  partialize: (state) => ({ tenantSlug: state.tenantSlug, items: state.items }),
}));
