"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { safePublicImage } from "@/lib/public-menu-presentation";

export function PublicProductImage({ src, alt, sizes = "100vw", className = "", variant = "large" }: {
  src: string | null | undefined; alt: string; sizes?: string; className?: string;
  variant?: "small" | "large";
}) {
  const original = safePublicImage(src);
  const safe = original && /^\/api\/public\/restaurants\/[a-z0-9-]+\/media\/[0-9a-f]{24}\/large$/.test(original)
    ? original.replace(/\/large$/, `/${variant}`) : original;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!safe || failedSrc === safe) return <div role="img" aria-label={`${alt}: no image`}
    className={`flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_70%_20%,rgba(255,157,51,.22),transparent_48%),linear-gradient(135deg,#29221e,#111)] text-[color:var(--primary-light)] ${className}`}>
    <ImageIcon aria-hidden="true" size={36} strokeWidth={1.4} />
  </div>;
  return <Image alt={alt} className={className} fill sizes={sizes} src={safe}
    unoptimized onError={() => setFailedSrc(safe)} />;
}
