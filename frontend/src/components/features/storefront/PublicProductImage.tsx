"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { useLocale } from "next-intl";
import { safePublicImage } from "@/lib/public-menu-presentation";

export function PublicProductImage({ src, alt, sizes = "100vw", className = "", variant = "large", priority = false }: {
  src: string | null | undefined; alt: string; sizes?: string; className?: string;
  variant?: "small" | "large";
  priority?: boolean;
}) {
  const original = safePublicImage(src);
  const safe = original && /^\/api\/public\/restaurants\/[a-z0-9-]+\/media\/[0-9a-f]{24}\/large$/.test(original)
    ? original.replace(/\/large$/, `/${variant}`) : original;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const locale = useLocale();
  if (!safe || failedSrc === safe) return <div role="img" aria-label={alt + (locale === "ar" ? "، لا توجد صورة" : ": no image")}
    className={`storefront-product-placeholder flex h-full w-full items-center justify-center bg-[color:var(--card-muted)] text-[color:var(--primary-light)] ${className}`}>
    <ImageIcon aria-hidden="true" size={36} strokeWidth={1.4} />
  </div>;
  return <Image alt={alt} className={className} fill sizes={sizes} src={safe}
    unoptimized loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined}
    onError={() => setFailedSrc(safe)} />;
}
