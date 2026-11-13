"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { dashboardAccess, useAuthStore } from "@/store/auth-store";

export function DashboardLayoutShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ar = useLocale() === "ar";
  const pathname = usePathname();
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const restore = useAuthStore((state) => state.restore);
  const revalidate = useAuthStore((state) => state.revalidate);
  const access = dashboardAccess(status, pathname === routes.login);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void revalidate(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [revalidate]);

  useEffect(() => {
    if (access === "redirect") router.replace(routes.login);
  }, [access, router]);

  if (access === "login") {
    return children;
  }

  if (access !== "show") {
    return (
      <main className="grid min-h-screen place-items-center bg-[color:var(--background)] px-6 text-center text-[color:var(--text)]" aria-live="polite">
        {status === "unavailable" ? (
          <div>
            <p>{ar ? "تعذر الاتصال بالخادم. حاول مرة أخرى." : "Cannot reach the server. Please try again."}</p>
            <button className="mt-4 rounded-xl bg-[color:var(--primary)] px-5 py-3 font-semibold text-[color:var(--background)]" onClick={() => void restore()} type="button">{ar ? "إعادة المحاولة" : "Retry"}</button>
          </div>
        ) : <p>{ar ? "جارٍ التحقق من الجلسة…" : "Checking your session…"}</p>}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--text)]">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_82%_8%,rgba(255,122,0,0.14),transparent_30%),radial-gradient(circle_at_15%_92%,rgba(212,160,23,0.1),transparent_34%),var(--page-gradient)]" />
      <DashboardSidebar />
      {menuOpen ? <DashboardSidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} /> : null}
      <DashboardHeader onMenuClick={() => setMenuOpen(true)} />
      <main className="px-4 py-6 sm:px-6 lg:ms-72 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
