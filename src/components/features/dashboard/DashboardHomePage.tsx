"use client";

import { motion } from "framer-motion";
import { DollarSign, Package, Plus, ShoppingBag, Timer, Utensils } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/formatters";
import { routes } from "@/lib/routes";
import type { DashboardStats, Order, Product, TopProduct } from "@/types";
import {
  ActionButton,
  DashboardCard,
  DashboardPageHeader,
  StatusBadge,
  dashboardEase,
} from "./DashboardUI";

const sales = [
  { day: "Mon", value: 48 },
  { day: "Tue", value: 64 },
  { day: "Wed", value: 58 },
  { day: "Thu", value: 72 },
  { day: "Fri", value: 86 },
  { day: "Sat", value: 100 },
  { day: "Sun", value: 78 },
];

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DashboardHomePage({
  stats,
  recentOrders,
  topProducts,
  products,
}: {
  stats: DashboardStats;
  recentOrders: Order[];
  topProducts: TopProduct[];
  products: Product[];
}) {
  const statCards = [
    {
      title: "Total Orders",
      value: stats.totalOrders.toLocaleString(),
      detail: "+18% from last week",
      icon: ShoppingBag,
    },
    {
      title: "Today Revenue",
      value: formatCurrency(stats.revenueToday),
      detail: "Strong dinner service",
      icon: DollarSign,
    },
    {
      title: "Pending Orders",
      value: stats.pendingOrders.toString(),
      detail: "Needs kitchen attention",
      icon: Timer,
    },
    {
      title: "Menu Items",
      value: products.length.toString(),
      detail: "Across 6 categories",
      icon: Utensils,
    },
  ];

  return (
    <section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;

          return (
            <motion.div
              className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.026)_60%,rgba(255,122,0,0.04))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl"
              key={card.title}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.55, ease: dashboardEase }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                    {card.title}
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{card.value}</div>
                </div>
                <span className="flex size-12 items-center justify-center rounded-2xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]">
                  <Icon aria-hidden="true" size={21} />
                </span>
              </div>
              <p className="mt-4 text-sm text-[color:var(--text-muted)]">{card.detail}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardCard className="p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-2xl font-semibold">Sales Overview</h3>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                Weekly demand using lightweight CSS bars.
              </p>
            </div>
            <span className="rounded-full border border-[color:var(--primary)]/25 bg-[color:var(--primary)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--primary-light)]">
              This Week
            </span>
          </div>
          <div className="mt-8 flex h-72 items-end gap-3">
            {sales.map((item) => (
              <div className="flex h-full flex-1 flex-col justify-end gap-3" key={item.day}>
                <motion.div
                  className="min-h-8 rounded-t-xl bg-[linear-gradient(180deg,var(--primary-light),var(--primary))] shadow-[0_0_28px_rgba(255,122,0,0.22)]"
                  initial={{ height: 0 }}
                  whileInView={{ height: `${item.value}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: dashboardEase }}
                />
                <div className="text-center text-xs font-semibold text-[color:var(--text-muted)]">
                  {item.day}
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold">Top Products</h3>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                Best-performing menu items today.
              </p>
            </div>
            <Package className="text-[color:var(--primary-light)]" size={22} />
          </div>
          <div className="mt-6 grid gap-4">
            {topProducts.map((topProduct) => {
              const product = products.find((item) => item.id === topProduct.productId);

              return (
                <div
                  className="grid grid-cols-[4rem_1fr_auto] items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                  key={topProduct.productId}
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl">
                    <Image
                      alt={topProduct.name}
                      className="object-cover"
                      fill
                      sizes="4rem"
                      src={product?.image ?? "/main.png"}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{topProduct.name}</div>
                    <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                      {topProduct.ordersCount} sold
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold text-[color:var(--primary-light)]">
                    {formatCurrency(topProduct.revenue)}
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardCard>
      </div>

      <DashboardCard className="mt-6 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-2xl font-semibold">Recent Orders</h3>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">
              Latest guest orders flowing through the kitchen.
            </p>
          </div>
          <Link href={routes.orders}>
            <ActionButton variant="ghost">View All Orders</ActionButton>
          </Link>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="text-xs font-semibold tracking-[0.16em] text-[color:var(--gold)] uppercase">
              <tr className="border-b border-white/10">
                <th className="py-3">Order</th>
                <th className="py-3">Customer</th>
                <th className="py-3">Status</th>
                <th className="py-3">Total</th>
                <th className="py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {recentOrders.map((order) => (
                <tr key={order.id} className="text-[color:var(--text-muted)]">
                  <td className="py-4 font-semibold text-[color:var(--text)]">
                    {order.orderNumber}
                  </td>
                  <td className="py-4">{order.customerName}</td>
                  <td className="py-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-4 text-[color:var(--primary-light)]">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="py-4">{formatTime(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </section>
  );
}
