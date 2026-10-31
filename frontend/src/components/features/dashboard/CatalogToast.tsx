"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { useEffect } from "react";

export function CatalogToast({ message, error = false, onClose }: { message: string; error?: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, error ? 10_000 : 5_000);
    return () => window.clearTimeout(timer);
  }, [message, error, onClose]);
  if (!message) return null;
  const Icon = error ? CircleAlert : CheckCircle2;
  return <div role={error ? "alert" : "status"} className={`fixed bottom-5 right-5 z-40 flex max-w-sm items-start gap-3 rounded-2xl border p-4 text-sm shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl ${error ? "border-red-400/30 bg-[#301b1b] text-red-100" : "border-emerald-400/30 bg-[#173026] text-emerald-100"}`}>
    <Icon aria-hidden="true" className="shrink-0" size={19} /><span>{message}</span><button type="button" aria-label="Dismiss notification" className="ml-2 shrink-0" onClick={onClose}><X aria-hidden="true" size={16} /></button>
  </div>;
}
