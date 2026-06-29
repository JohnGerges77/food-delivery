"use client";

import { Eye, MapPin, Phone, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import type { Order, OrderStatus } from "@/types";
import {
  ActionButton,
  DashboardCard,
  DashboardModal,
 
  SearchInput,
  StatusBadge,
  inputClass,
} from "./DashboardUI";

const tabs: Array<{ value: "all" | OrderStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "out-for-delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const statusFlow: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "out-for-delivery",
  "delivered",
];

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function itemCount(order: Order) {
  return order.items.reduce((count, item) => count + item.quantity, 0);
}

export function DashboardOrdersPage({ orders }: { orders: Order[] }) {
  const [items, setItems] = useState(orders);
  const [activeTab, setActiveTab] = useState<"all" | OrderStatus>("all");
  const [query, setQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return items.filter((order) => {
      const matchesStatus = activeTab === "all" || order.status === activeTab;
      const matchesQuery =
        !normalized ||
        [order.orderNumber, order.customerName, order.phone, order.address, order.status]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return matchesStatus && matchesQuery;
    });
  }, [activeTab, items, query]);

  function updateStatus(orderId: string, status: OrderStatus) {
    setItems((current) =>
      current.map((order) => (order.id === orderId ? { ...order, status } : order)),
    );
    setSelectedOrder((current) =>
      current && current.id === orderId ? { ...current, status } : current,
    );
  }

  return (
    <section>
      

      <DashboardCard className="p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by order, customer, phone, address..."
          />
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => (
              <button
                className={`h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-all ${
                  activeTab === tab.value
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--background)] shadow-[0_14px_34px_rgba(255,122,0,0.28)]"
                    : "border-white/10 bg-white/[0.035] text-[color:var(--text-muted)] hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]"
                }`}
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </DashboardCard>

      <div className="mt-6 grid gap-4">
        {filteredOrders.map((order) => (
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
                  {formatTime(order.createdAt)}
                </div>
              </div>

              <div className="grid gap-2 text-sm text-[color:var(--text-muted)]">
                <span className="flex items-start gap-2">
                  <Phone className="mt-0.5 shrink-0 text-[color:var(--primary-light)]" size={15} />
                  {order.phone}
                </span>
                <span className="flex items-start gap-2">
                  <MapPin className="mt-0.5 shrink-0 text-[color:var(--primary-light)]" size={15} />
                  {order.address}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <ShoppingBag className="text-[color:var(--primary-light)]" size={16} />
                <span>{itemCount(order)} items</span>
              </div>

              <div className="text-xl font-semibold text-[color:var(--primary-light)]">
                {formatCurrency(order.total)}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={order.status} />
                <select
                  className={`${inputClass} h-10 w-48 appearance-none px-3`}
                  onChange={(event) =>
                    updateStatus(order.id, event.target.value as OrderStatus)
                  }
                  value={order.status}
                >
                  {tabs
                    .filter((tab) => tab.value !== "all")
                    .map((tab) => (
                      <option
                        className="bg-[color:var(--background)]"
                        key={tab.value}
                        value={tab.value}
                      >
                        {tab.label}
                      </option>
                    ))}
                </select>
              </div>

              <ActionButton variant="ghost" onClick={() => setSelectedOrder(order)}>
                <Eye aria-hidden="true" size={15} />
                View
              </ActionButton>
            </div>
          </article>
        ))}
      </div>

      <DashboardModal
        open={Boolean(selectedOrder)}
        title={selectedOrder ? `Order ${selectedOrder.orderNumber}` : "Order Details"}
        onClose={() => setSelectedOrder(null)}
      >
          {selectedOrder ? (
            <div className="grid gap-5">
              <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    Customer
                  </div>
                  <div className="mt-2 font-semibold">{selectedOrder.customerName}</div>
                  <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                    {selectedOrder.phone}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    Delivery Address
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                    {selectedOrder.address}
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
                      <Image
                        alt={item.name}
                        className="object-cover"
                        fill
                        sizes="4rem"
                        src={item.image}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{item.name}</div>
                      <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                        Qty {item.quantity} x {formatCurrency(item.price)}
                      </div>
                    </div>
                    <div className="font-semibold text-[color:var(--primary-light)]">
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Notes
                </div>
                <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                  {selectedOrder.notes ?? "No special notes."}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="mb-4 text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    Status Timeline
                  </div>
                  <div className="grid gap-3">
                    {statusFlow.map((status) => {
                      const activeIndex = statusFlow.indexOf(selectedOrder.status);
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
                            {status.replaceAll("-", " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="mb-4 text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    Total
                  </div>
                  <div className="grid gap-3 text-sm text-[color:var(--text-muted)]">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery fee</span>
                      <span>{formatCurrency(selectedOrder.deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-3 text-lg font-semibold text-[color:var(--text)]">
                      <span>Total</span>
                      <span className="text-[color:var(--primary-light)]">
                        {formatCurrency(selectedOrder.total)}
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
