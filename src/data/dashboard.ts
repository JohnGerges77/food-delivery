import type { DashboardStats, TopProduct } from "@/types";

export const dashboardStats: DashboardStats = {
  totalOrders: 342,
  pendingOrders: 8,
  revenueToday: 2846.75,
  averagePreparationTime: 19,
};

export const topProducts: TopProduct[] = [
  {
    productId: "prod-smoked-gold-burger",
    name: "Smoked Gold Burger",
    ordersCount: 86,
    revenue: 1591,
  },
  {
    productId: "prod-truffle-alfredo-pasta",
    name: "Truffle Alfredo Pasta",
    ordersCount: 72,
    revenue: 1296,
  },
  {
    productId: "prod-honey-glazed-chicken",
    name: "Honey Glazed Chicken",
    ordersCount: 58,
    revenue: 1116.5,
  },
];
