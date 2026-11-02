"use client";

import { create } from "zustand";
import type { CartItem, Product } from "@/types";
import type { PublicProduct } from "@/services/public-menu";

type CartState = {
  tenantSlug: string | null;
  items: CartItem[];
  addRevision: number;
  setTenant: (slug: string) => void;
  addPublicItem: (slug: string, product: PublicProduct, quantity?: number) => void;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  increaseQuantity: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: (deliveryFee: number) => number;
};

export const useCartStore = create<CartState>((set, get) => ({
  tenantSlug: null,
  items: [],
  addRevision: 0,
  setTenant: (slug) => set((state) => state.tenantSlug === slug ? state : { tenantSlug: slug, items: [] }),
  addPublicItem: (slug, product, quantity = 1) => set((state) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1 ||
        !/^[0-9a-fA-F]{24}$/.test(product.id)) return state;
    const items = state.tenantSlug === slug ? state.items : [];
    const safeQuantity = quantity;
    const existing = items.find((item) => item.productId === product.id);
    return { tenantSlug: slug, addRevision: state.addRevision + 1, items: existing
      ? items.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + safeQuantity } : item)
      : [...items, { productId: product.id, name: product.name, price: product.price,
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
      items: state.items.filter((item) => item.productId !== productId),
    })),
  increaseQuantity: (productId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    })),
  decreaseQuantity: (productId) =>
    set((state) => ({
      items: state.items
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, item.quantity - 1) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    })),
  clearCart: () => set({ items: [] }),
  getSubtotal: () =>
    get().items.reduce((total, item) => total + item.price * item.quantity, 0),
  getTotal: (deliveryFee) => get().getSubtotal() + deliveryFee,
}));
