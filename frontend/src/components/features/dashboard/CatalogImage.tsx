"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { validOwnerImageUrl } from "@/services/owner-catalog-common";

export function CatalogImage({ src, alt, sizes = "8rem" }: { src: string | null; alt: string; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || !validOwnerImageUrl(src) || failed) return <div role="img" aria-label={`${alt}: no image`} className="flex h-full w-full items-center justify-center bg-white/[0.06] text-[color:var(--text-muted)]"><ImageIcon aria-hidden="true" size={26} /></div>;
  return <Image alt={alt} className="object-cover" fill sizes={sizes} src={src} unoptimized onError={() => setFailed(true)} />;
}
