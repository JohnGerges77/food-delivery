"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { usePlatformAdmin } from "@/store/platform-admin-store";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const status = usePlatformAdmin((state) => state.status);
  const admin = usePlatformAdmin((state) => state.admin);
  const restore = usePlatformAdmin((state) => state.restore);
  const logout = usePlatformAdmin((state) => state.logout);
  const loginPage = pathname.endsWith("/admin/login");
  const ar = locale === "ar";
  useEffect(() => { void restore(); }, [restore]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void restore(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [restore]);
  useEffect(() => {
    if (!loginPage && status === "unauthenticated") router.replace(`/${locale}/admin/login`);
  }, [loginPage, locale, router, status]);
  if (loginPage) return children;
  if (status !== "authenticated") return (
    <main className="grid min-h-screen place-items-center bg-[#0b0d12] px-6 text-white" aria-live="polite">
      {status === "unavailable" ? <div className="text-center">
        <p>{ar ? "تعذّر الاتصال بالخادم" : "Cannot reach the server"}</p>
        <button className="mt-4 rounded-xl bg-orange-500 px-5 py-3 text-black" onClick={() => void restore()}>
          {ar ? "إعادة المحاولة" : "Retry"}</button>
      </div> : <p>{ar ? "جارٍ التحقق من الجلسة…" : "Checking your session…"}</p>}
    </main>);
  return <div className="min-h-screen bg-[#0b0d12] text-white">
    <header className="border-b border-white/10 bg-[#10131b]">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-wrap items-center gap-4 px-5 py-5">
        <Link href={`/${locale}/admin`} className="shrink-0 text-xl font-extrabold tracking-wide text-orange-400">SAVORA <span className="text-xs font-medium text-white/60">PLATFORM</span></Link>
        <nav className="flex gap-4 text-sm sm:ms-10">
          <Link href={`/${locale}/admin`} className="hover:text-orange-400">{ar ? "نظرة عامة" : "Overview"}</Link>
          <Link href={`/${locale}/admin/restaurants`} className="hover:text-orange-400">{ar ? "المطاعم" : "Restaurants"}</Link>
        </nav>
        <div className="ms-auto flex min-w-0 items-center gap-3 text-sm">
          <span className="hidden max-w-40 truncate text-white/55 lg:inline" dir="ltr" title={admin?.email}>{admin?.email}</span>
          <Link href={`/${ar ? "en" : "ar"}${pathname.slice(3)}`} className="rounded-lg border border-white/20 px-3 py-2">{ar ? "EN" : "عربي"}</Link>
          <button className="rounded-lg border border-orange-500/50 px-3 py-2 text-orange-300" onClick={async () => {
            try { await logout(); router.replace(`/${locale}/admin/login`); }
            catch { void restore(); }
          }}>{ar ? "خروج" : "Log out"}</button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
  </div>;
}
