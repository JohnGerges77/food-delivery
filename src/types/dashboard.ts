export type DashboardStats = {
  totalOrders: number;
  pendingOrders: number;
  revenueToday: number;
  averagePreparationTime: number;
};

export type TopProduct = {
  productId: string;
  name: string;
  ordersCount: number;
  revenue: number;
};
