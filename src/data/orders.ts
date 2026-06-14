import type { Order } from "@/types";

export const orders: Order[] = [
  {
    id: "ord-1001",
    orderNumber: "RM-1001",
    customerName: "Maya Hassan",
    phone: "+20 100 555 0188",
    address: "12 Nile Street, Garden City",
    notes: "Please call when nearby.",
    items: [
      {
        productId: "prod-margherita",
        name: "Margherita Pizza",
        price: 12.5,
        image: "/images/products/margherita.jpg",
        quantity: 2,
      },
      {
        productId: "prod-lemonade",
        name: "Mint Lemonade",
        price: 4.5,
        image: "/images/products/mint-lemonade.jpg",
        quantity: 2,
      },
    ],
    subtotal: 34,
    deliveryFee: 3,
    total: 37,
    status: "preparing",
    createdAt: "2026-06-10T18:20:00.000Z",
  },
  {
    id: "ord-1002",
    orderNumber: "RM-1002",
    customerName: "Omar Adel",
    phone: "+20 111 222 3344",
    address: "44 Tahrir Square, Downtown",
    items: [
      {
        productId: "prod-smash-burger",
        name: "Double Smash Burger",
        price: 13.75,
        image: "/images/products/smash-burger.jpg",
        quantity: 1,
      },
    ],
    subtotal: 13.75,
    deliveryFee: 3,
    total: 16.75,
    status: "out-for-delivery",
    createdAt: "2026-06-10T19:05:00.000Z",
  },
];
