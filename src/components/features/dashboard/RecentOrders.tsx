import { OrderCard } from "@/components/features/orders/OrderCard";
import type { Order } from "@/types";

export function RecentOrders({ orders }: { orders: Order[] }) {
  return (
    <div className="grid gap-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
