"use client";

import type { ReactNode } from "react";
import { useCartStore } from "@/store/cart-store";

export function CartAttention({ children }: { children: ReactNode }) {
  const revision = useCartStore((state) => state.addRevision);
  return <span key={revision} className={revision ? "cart-add-attention inline-flex items-center gap-2" : "inline-flex items-center gap-2"}>{children}</span>;
}
