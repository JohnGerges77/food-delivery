import { ProductCard } from "@/components/features/menu/ProductCard";
import type { Product } from "@/types";

export function MenuGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
