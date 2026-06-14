"use client";

import { create } from "zustand";
import type { Order, OrderStatus } from "@/types";

type OrderState = {
  currentOrder?: Order;
  orders: Order[];
  setCurrentOrder: (order?: Order) => void;
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
};

export const useOrderStore = create<OrderState>((set) => ({
  currentOrder: undefined,
  orders: [],
  setCurrentOrder: (order) => set({ currentOrder: order }),
  addOrder: (order) =>
    set((state) => ({
      orders: [order, ...state.orders],
      currentOrder: order,
    })),
  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, status } : order,
      ),
      currentOrder:
        state.currentOrder?.id === orderId
          ? { ...state.currentOrder, status }
          : state.currentOrder,
    })),
}));
