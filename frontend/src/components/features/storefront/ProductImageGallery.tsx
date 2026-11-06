"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { safePublicImage } from "@/lib/public-menu-presentation";
import type { PublicProduct } from "@/services/public-menu";
import { PublicProductImage } from "./PublicProductImage";

export function ProductImageGallery({ product, sizes, className = "object-cover" }: {
  product: PublicProduct; sizes: string; className?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const ar = useLocale() === "ar";
  const images = [product.imageUrl, ...product.images].filter((url): url is string => Boolean(safePublicImage(url)));
  const active = selected && images.includes(selected) ? selected : images[0] ?? null;
  return <>
    <PublicProductImage src={active} alt={product.name} sizes={sizes} className={className} />
    {images.length > 1 && <div className="absolute inset-x-3 bottom-3 z-20 flex gap-2 overflow-x-auto rounded-xl bg-black/55 p-2 backdrop-blur" role="group" aria-label={ar ? "صور المنتج" : "Product images"}>
      {images.map((url, index) => <button key={`${url}:${index}`} type="button"
        aria-label={ar ? `اعرض الصورة ${index + 1} من ${product.name}` : `Show image ${index + 1} of ${product.name}`} aria-pressed={active === url}
        onClick={() => setSelected(url)}
        className="relative size-12 shrink-0 overflow-hidden rounded-md border-2 border-white/40 aria-pressed:border-[color:var(--sf-primary)] focus-visible:outline-2 focus-visible:outline-white">
        <PublicProductImage src={url} alt="" sizes="48px" variant="small" className="object-cover" />
      </button>)}
    </div>}
  </>;
}
