import { ApiError, apiRequest, getCsrfToken } from "./api-client.ts";

export async function getOwnerMediaAvailability(): Promise<boolean> {
  const result = await apiRequest<{ available: unknown }>("/api/owner/media/capabilities");
  if (typeof result?.available !== "boolean") throw new ApiError(null, "Invalid media availability response");
  return result.available;
}

export type OwnerMediaTarget = { kind: "product" | "gallery"; id: string } | { kind: "logo" };

function pathFor(target: OwnerMediaTarget) {
  return target.kind === "logo" ? "/api/owner/media/logo" :
    `/api/owner/media/products/${encodeURIComponent(target.id)}${target.kind === "gallery" ? "/images" : ""}`;
}

export function uploadOwnerImage(target: OwnerMediaTarget, file: File,
  onProgress: (percent: number) => void): { promise: Promise<string>; cancel: () => void } {
  const xhr = new XMLHttpRequest();
  let cancelled = false;
  const promise = (async () => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 4_000_000 || file.size === 0) {
      throw new ApiError(415, "Choose a JPEG, PNG, or WebP image up to 4 MB.");
    }
    const csrf = await getCsrfToken();
    if (cancelled) throw new ApiError(null, "Image upload cancelled.");
    return new Promise<string>((resolve, reject) => {
      xhr.open("PUT", pathFor(target));
      xhr.withCredentials = true;
      xhr.timeout = 30_000;
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.setRequestHeader("X-Savora-CSRF", csrf);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
      };
      xhr.onerror = () => reject(new ApiError(null, "Image upload failed. Retry."));
      xhr.ontimeout = () => reject(new ApiError(null, "Image upload timed out. Retry."));
      xhr.onabort = () => reject(new ApiError(null, "Image upload cancelled."));
      xhr.onload = () => {
        if (xhr.status !== 200) {
          reject(new ApiError(xhr.status, xhr.status === 503 ?
            "Image storage is not ready. Contact your administrator." :
            xhr.status === 409 ? "Image changed. Refresh and retry." :
            xhr.status === 413 ? "Image exceeds the upload limit." :
            xhr.status === 415 ? "Image content or dimensions are invalid." :
            "Image upload was rejected."));
          return;
        }
        try {
          const body: unknown = JSON.parse(xhr.responseText);
          if (body && typeof body === "object" && "url" in body &&
              typeof body.url === "string" && body.url.startsWith("/api/public/restaurants/")) {
            resolve(body.url); return;
          }
        } catch { /* Invalid response */ }
        reject(new ApiError(null, "Invalid image upload response."));
      };
      xhr.send(file);
    });
  })();
  return { promise, cancel: () => { cancelled = true; if (xhr.readyState !== XMLHttpRequest.UNSENT) xhr.abort(); } };
}

export async function deleteOwnerImage(target: Exclude<OwnerMediaTarget, { kind: "gallery" }>): Promise<void> {
  const response = await fetch(pathFor(target), {
    method: "DELETE", credentials: "same-origin", cache: "no-store",
    headers: { "X-Savora-CSRF": await getCsrfToken() },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new ApiError(response.status, response.status === 503 ?
    "Image storage is not configured for this environment." : "Could not remove image.");
}

export async function deleteOwnerGalleryImage(productId: string, assetId: string): Promise<void> {
  const response = await fetch(`/api/owner/media/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(assetId)}`, {
    method: "DELETE", credentials: "same-origin", cache: "no-store",
    headers: { "X-Savora-CSRF": await getCsrfToken() },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new ApiError(response.status, response.status === 503 ?
    "Image storage is not configured for this environment." : "Could not remove gallery image.");
}

export function isManagedImage(url: string | null | undefined): boolean {
  return typeof url === "string" &&
    /^\/api\/public\/restaurants\/[a-z0-9-]+\/media\/[0-9a-f]{24}\/large$/.test(url);
}
