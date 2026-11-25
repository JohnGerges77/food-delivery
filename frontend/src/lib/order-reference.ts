export function validDisplayNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1001;
}

export function orderReference(order: { orderNumber: string; displayNumber?: number | null }) {
  return validDisplayNumber(order.displayNumber) ? `#${order.displayNumber}` : order.orderNumber;
}
