"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { safePublicImage } from "@/lib/public-menu-presentation";

export function PublicProductImage({ src, alt, sizes = "100vw", className = "" }: {
  src: string | null | undefined; alt: string; sizes?: string; className?: string;
}) {
  const safe = safePublicImage(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!safe || failedSrc === safe) return <div role="img" aria-label={`${alt}: no image`}
    className={`flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_70%_20%,rgba(255,157,51,.22),transparent_48%),linear-gradient(135deg,#29221e,#111)] text-[color:var(--primary-light)] ${className}`}>
    <ImageIcon aria-hidden="true" size={36} strokeWidth={1.4} />
  </div>;
  return <Image alt={alt} className={className} fill sizes={sizes} src={safe}
    unoptimized onError={() => setFailedSrc(safe)} />;
}
