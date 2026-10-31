import { orders } from "@/data/orders";
import { localizeOrder } from "@/data/localized";
import type { Locale } from "@/i18n/routing";
import type { Order, OrderStatus } from "@/types";

type CreateMockOrderInput = Omit<Order, "id" | "orderNumber" | "createdAt" | "status"> &
  Partial<Pick<Order, "status">>;

export function getOrders(locale?: Locale) {
  return orders.map((order) => localizeOrder(order, locale));
}

export function getOrderById(id: string, locale?: Locale) {
  const order = orders.find((item) => item.id === id);
  return order ? localizeOrder(order, locale) : undefined;
}

export function getOrderByNumber(orderNumber: string, locale?: Locale) {
  const order = orders.find((item) => item.orderNumber === orderNumber);
  return order ? localizeOrder(order, locale) : undefined;
}

export function getOrdersByStatus(status: OrderStatus, locale?: Locale) {
  return getOrders(locale).filter((order) => order.status === status);
}

export function createMockOrder(orderData: CreateMockOrderInput): Order {
  const nextNumber = orders.length + 1001;
  const order: Order = {
    ...orderData,
    id: `ord-${nextNumber}`,
    orderNumber: `RM-${nextNumber}`,
    status: orderData.status ?? "pending",
    createdAt: new Date().toISOString(),
  };

  orders.unshift(order);
  return order;
}

export function updateMockOrderStatus(orderId: string, status: OrderStatus) {
  const order = orders.find((item) => item.id === orderId);

  if (!order) {
    return undefined;
  }

  order.status = status;
  return order;
}
