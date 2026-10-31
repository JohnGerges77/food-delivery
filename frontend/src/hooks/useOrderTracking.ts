"use client";

import { useOrderStore } from "@/store/order-store";

export function useOrderTracking() {
  const currentOrder = useOrderStore((state) => state.currentOrder);
  const setCurrentOrder = useOrderStore((state) => state.setCurrentOrder);

  return {
    currentOrder,
    setCurrentOrder,
  };
}
