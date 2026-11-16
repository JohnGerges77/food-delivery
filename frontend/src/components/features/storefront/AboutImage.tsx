"use client";

import Image from "next/image";
import { useState } from "react";
import { safePublicImage } from "@/lib/public-menu-presentation";

export function AboutImage({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const image = safePublicImage(src);
  if (!image || image === failed) return null;
  return <div className="mx-auto mb-12 aspect-video w-[calc(100%-2.5rem)] max-w-5xl overflow-hidden rounded-2xl">
    <div className="relative h-full w-full"><Image src={image} alt={name} fill unoptimized sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" onError={() => setFailed(image)} /></div>
  </div>;
}
