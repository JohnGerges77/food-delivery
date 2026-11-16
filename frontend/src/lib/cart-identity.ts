export const cartItemKey = (item: { productId: string; variantId?: string }) => item.variantId ? `${item.productId}:${item.variantId}` : item.productId;
