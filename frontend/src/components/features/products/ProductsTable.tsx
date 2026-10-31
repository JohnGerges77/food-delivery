import { ProductRow } from "@/components/features/products/ProductRow";
import type { Product } from "@/types";

export function ProductsTable({ products }: { products: Product[] }) {
  return (
    <div className="grid gap-3">
      {products.map((product) => (
        <ProductRow key={product.id} product={product} />
      ))}
    </div>
  );
}
