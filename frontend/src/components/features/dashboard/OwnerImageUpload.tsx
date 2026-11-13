"use client";

import { ownerText } from "./owner-copy";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { deleteOwnerImage, isManagedImage, uploadOwnerImage,
  type OwnerMediaTarget } from "@/services/owner-media-service";
import { useOwnerMediaAvailability } from "./useOwnerMediaAvailability";

export function OwnerImageUpload({ target, currentUrl, onChanged }: {
  target: OwnerMediaTarget; currentUrl: string | null; onChanged: (url: string | null) => void;
}) {
  const ar = useLocale() === "ar";
  const [file, setFile] = useState<File | null>(null);
  const { available, loading } = useOwnerMediaAvailability();
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operationRef = useRef<ReturnType<typeof uploadOwnerImage> | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; operationRef.current?.cancel(); };
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function upload() {
    if (!file || busy || !available) return;
    setBusy(true); setError(""); setProgress(0);
    const operation = uploadOwnerImage(target, file, setProgress);
    operationRef.current = operation;
    try {
      const url = await operation.promise;
      if (!mountedRef.current) return;
      onChanged(url); setFile(null); setPreview(null); setProgress(null);
    } catch (cause) {
      if (mountedRef.current) setError(ar ? ownerText("ar", "Image upload failed.") : cause instanceof Error ? cause.message : "Image upload failed.");
    } finally { operationRef.current = null; if (mountedRef.current) setBusy(false); }
  }

  async function remove() {
    if (busy || !available || target.kind === "gallery" || !isManagedImage(currentUrl)) return;
    setBusy(true); setError("");
    try { await deleteOwnerImage(target); if (mountedRef.current) { onChanged(null); setFile(null); setPreview(null); } }
    catch (cause) { if (mountedRef.current) setError(ar ? ownerText("ar", "Could not remove image.") : cause instanceof Error ? cause.message : "Could not remove image."); }
    finally { if (mountedRef.current) setBusy(false); }
  }

  return <div className="rounded-xl border border-white/10 p-4">
    {!available && <p role="status" className="text-sm text-[color:var(--text-muted)]">{loading ? (ar ? "جارٍ التحقق من رفع الصور…" : "Checking image uploads…") : (ar ? "رفع الصور غير متاح حاليًا. تظل روابط الصور الحالية متاحة." : "Image uploads are currently unavailable. Existing image URLs remain available.")}</p>}
    {available && <>
    <label className="block text-sm font-semibold" htmlFor={`media-${target.kind === "logo" ? "logo" : `${target.id}-${target.kind}`}`}>{target.kind === "logo" ? ownerText((ar ? "ar" : "en"), "Restaurant logo") : target.kind === "gallery" ? ownerText((ar ? "ar" : "en"), "Additional product image") : ownerText((ar ? "ar" : "en"), "Product image")}</label>
    <input id={`media-${target.kind === "logo" ? "logo" : `${target.id}-${target.kind}`}`} type="file"
      accept="image/jpeg,image/png,image/webp" disabled={busy} className="mt-3 block w-full text-sm"
      onChange={(event) => { const selected = event.target.files?.[0] ?? null;
        setFile(selected); setPreview(selected ? URL.createObjectURL(selected) : null);
        setError(""); event.currentTarget.value = ""; }} />
    <p className="mt-2 text-xs text-[color:var(--text-muted)]">{ownerText((ar ? "ar" : "en"), "JPEG, PNG, or WebP · up to 4 MB. A clear image at least 16 × 16 pixels.")}</p>
    {(preview || currentUrl) && <div className="relative mt-3 size-28 overflow-hidden rounded-lg border border-white/10">
      <Image src={preview || currentUrl!} alt={preview ? ownerText((ar ? "ar" : "en"), "Selected image preview") : ownerText((ar ? "ar" : "en"), "Current image")} fill
        sizes="112px" unoptimized className="object-cover" />
    </div>}
    {progress !== null && <div className="mt-3" role="status" aria-live="polite">
      <span className="text-sm">{ownerText((ar ? "ar" : "en"), "Uploading")}{" "}{progress}%</span>
      <progress className="mt-1 block w-full" value={progress} max={100} />
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" onClick={() => void upload()} disabled={!file || busy}
        className="min-h-11 rounded-lg bg-[color:var(--primary)] px-4 font-semibold text-[color:var(--background)] disabled:opacity-50">{currentUrl ? ownerText((ar ? "ar" : "en"), "Replace image") : ownerText((ar ? "ar" : "en"), "Upload image")}</button>
      {target.kind !== "gallery" && isManagedImage(currentUrl) && <button type="button" onClick={() => void remove()} disabled={busy}
        className="min-h-11 rounded-lg border border-red-300/40 px-4 text-red-200 disabled:opacity-50">{ownerText((ar ? "ar" : "en"), "Remove uploaded image")}</button>}
    </div>
    </>}
  </div>;
}
