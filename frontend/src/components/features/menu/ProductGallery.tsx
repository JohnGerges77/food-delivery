import type { Product } from "@/types";

export function ProductGallery({ product }: { product: Product }) {
  return (
    <div className="grid gap-2 text-sm text-zinc-600">
      {product.images.map((image) => (
        <div className="rounded-md border border-zinc-200 bg-white p-3" key={image}>
          {image}
        </div>
      ))}
    </div>
  );
}
