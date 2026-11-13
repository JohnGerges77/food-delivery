"use client";

import { Bell, LogOut, Menu, Search } from "lucide-react";
import { useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useAuthStore } from "@/store/auth-store";

function getPageTitle(pathname: string) {
  if (pathname.startsWith(routes.products)) {
    return "Products";
  }

  if (pathname.startsWith(routes.categories)) {
    return "Categories";
  }

  if (pathname.startsWith(routes.orders)) {
    return "Orders";
  }

  if (pathname.startsWith(routes.settings)) {
    return "Settings";
  }

  return "Overview";
}

export function DashboardHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const ar = useLocale() === "ar";
  const englishTitle = getPageTitle(pathname);
  const title = ar ? ({ Overview: "نظرة عامة", Products: "المنتجات", Categories: "الأقسام", Orders: "الطلبات", Settings: "الإعدادات" } as Record<string, string>)[englishTitle] : englishTitle;
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const context = useAuthStore((state) => state.context);

  async function handleLogout() {
    try {
      await logout();
      router.replace(routes.login);
    } catch {
      // The layout hides owner screens until a fresh /me request resolves.
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[color:var(--background)]/82 px-4 py-4 text-[color:var(--text)] shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-2xl sm:px-6 lg:ms-72 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          aria-label={ar ? "فتح قائمة لوحة التحكم" : "Open dashboard menu"}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[color:var(--text)] lg:hidden"
          onClick={onMenuClick}
          type="button"
        >
          <Menu aria-hidden="true" size={19} />
        </button>

        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-[0.2em] text-[color:var(--gold)] uppercase">
            {ar ? "لوحة تحكم Savora" : "Savora Dashboard"}
          </div>
          <h1 className="truncate text-2xl font-semibold">{title}</h1>
        </div>

        <div className="ms-auto hidden min-w-64 max-w-md flex-1 md:block">
          <label className="relative block">
            <span className="sr-only">{ar ? "البحث في لوحة التحكم" : "Search dashboard"}</span>
            <Search
              aria-hidden="true"
              className="absolute start-4 top-1/2 -translate-y-1/2 text-[color:var(--primary-light)]"
              size={17}
            />
            <input
              className="h-11 w-full rounded-full border border-white/10 bg-white/[0.045] ps-11 pe-4 text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-muted)]/55 focus:border-[color:var(--primary)]/60 focus:shadow-[0_0_0_4px_rgba(255,122,0,0.12)]"
              placeholder={ar ? "البحث عن الطلبات والمنتجات..." : "Search orders, products..."}
              type="search"
            />
          </label>
        </div>

        <ThemeToggle />

        <button aria-label={ar ? "تسجيل الخروج" : "Log out"} title={ar ? "تسجيل الخروج" : "Log out"} className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[color:var(--text-muted)] hover:text-[color:var(--primary-light)]" onClick={() => void handleLogout()} type="button">
          <LogOut aria-hidden="true" size={18} />
        </button>

        <button
          aria-label={ar ? "الإشعارات" : "Notifications"}
          className="relative flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--primary-light)]"
          type="button"
        >
          <Bell aria-hidden="true" size={18} />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-[color:var(--primary)]" />
        </button>

        <Link
          className="flex size-11 items-center justify-center rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-sm font-bold text-[color:var(--primary-light)]"
          href={routes.home}
          aria-label={ar ? "عرض واجهة المطعم" : "View storefront"}
        >
          {context?.user.name.slice(0, 2).toUpperCase() ?? "SA"}
        </Link>
      </div>
    </header>
  );
}
