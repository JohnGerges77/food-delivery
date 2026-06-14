import type { DashboardStats, TopProduct } from "@/types";

export const dashboardStats: DashboardStats = {
  totalOrders: 128,
  pendingOrders: 6,
  revenueToday: 1840.5,
  averagePreparationTime: 17,
};

export const topProducts: TopProduct[] = [
  {
    productId: "prod-smash-burger",
    name: "Double Smash Burger",
    ordersCount: 42,
    revenue: 577.5,
  },
  {
    productId: "prod-margherita",
    name: "Margherita Pizza",
    ordersCount: 36,
    revenue: 450,
  },
  {
    productId: "prod-pepperoni",
    name: "Pepperoni Pizza",
    ordersCount: 28,
    revenue: 420,
  },
];
