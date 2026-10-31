export type CartItem = {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  notes?: string;
};

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "out-for-delivery"
  | "delivered"
  | "cancelled";

export type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  notes?: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
};
