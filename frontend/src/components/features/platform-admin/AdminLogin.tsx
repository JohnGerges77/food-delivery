"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { usePlatformAdmin } from "@/store/platform-admin-store";
import { PlatformApiError } from "@/services/platform-admin-service";

export function AdminLogin() {
  const locale = useLocale(); const ar = locale === "ar";
  const router = useRouter();
  const status = usePlatformAdmin((state) => state.status);
  const login = usePlatformAdmin((state) => state.login);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (status === "authenticated") router.replace(`/${locale}/admin`); }, [status, locale, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") ?? "");
    const password = String(fields.get("password") ?? "");
    setBusy(true); setError("");
    try { await login(email, password); router.replace(`/${locale}/admin`); }
    catch (cause) { setError(cause instanceof PlatformApiError && cause.status === 429 ?
      (ar ? "محاولات كثيرة. حاول لاحقًا." : "Too many attempts. Try later.") :
      (ar ? "تعذّر تسجيل الدخول. تحقق من البيانات والاتصال." : "Sign in failed. Check your details and connection.")); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_75%_15%,#4a270f,transparent_35%),#0b0d12] px-5 text-white">
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171a22] p-7 shadow-2xl sm:p-10">
      <p className="text-sm font-bold tracking-widest text-orange-400">SAVORA / PLATFORM</p>
      <h1 className="mt-5 text-3xl font-extrabold">{ar ? "دخول مشرف المنصة" : "Platform access"}</h1>
      <p className="mt-2 text-sm text-white/55">{ar ? "إدارة المطاعم وحسابات المالكين" : "Manage restaurants and owner accounts"}</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block text-sm">{ar ? "البريد الإلكتروني" : "Email"}<input name="email" type="email" required autoComplete="username" maxLength={254} className="mt-2 w-full rounded-xl border border-white/15 bg-[#0e1118] p-3 outline-none focus:border-orange-400" /></label>
        <label className="block text-sm">{ar ? "كلمة المرور" : "Password"}<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-white/15 bg-[#0e1118] p-3 outline-none focus:border-orange-400" /></label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-orange-500 p-3 font-bold text-black disabled:opacity-50">{busy ? (ar ? "جارٍ الدخول…" : "Signing in…") : (ar ? "دخول" : "Sign in")}</button>
      </form>
    </div>
  </main>;
}
