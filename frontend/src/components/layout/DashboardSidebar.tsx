"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  FolderOpen,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  X,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

const dashboardLinks = [
  { href: routes.dashboard, label: "Overview", icon: LayoutDashboard },
  { href: routes.products, label: "Products", icon: Package },
  { href: routes.categories, label: "Categories", icon: FolderOpen },
  { href: routes.orders, label: "Orders", icon: ShoppingBag },
  { href: routes.settings, label: "Settings", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  if (href === routes.dashboard) {
    return pathname === routes.dashboard;
  }

  return pathname.startsWith(href);
}

export function DashboardSidebar({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const sidebar = (
    <aside className="flex h-full w-72 flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,rgba(31,31,31,0.94),rgba(13,13,13,0.98))] text-[color:var(--text)] shadow-[24px_0_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <div className="flex min-h-20 items-center justify-between border-b border-white/10 px-5">
        <Link className="group flex items-center gap-3" href={routes.dashboard} onClick={onClose}>
          <span className="flex size-11 items-center justify-center rounded-2xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)] shadow-[0_0_30px_rgba(255,122,0,0.18)]">
            <BarChart3 aria-hidden="true" size={21} />
          </span>
          <span>
            <span className="block text-lg font-semibold tracking-[0.16em]">SAVORA</span>
            <span className="text-xs text-[color:var(--text-muted)]">Restaurant Admin</span>
          </span>
        </Link>
        <button
          aria-label="Close dashboard menu"
          className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[color:var(--text-muted)] lg:hidden"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <nav className="grid gap-2 p-4">
        {dashboardLinks.map((link) => {
          const Icon = link.icon;
          const active = isActivePath(pathname, link.href);

          return (
            <Link
              className={`group relative flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition-all duration-300 ${
                active
                  ? "bg-[color:var(--primary)] text-[color:var(--background)] shadow-[0_18px_44px_rgba(255,122,0,0.28)]"
                  : "text-[color:var(--text-muted)] hover:bg-white/[0.06] hover:text-[color:var(--primary-light)]"
              }`}
              href={link.href}
              key={link.href}
              onClick={onClose}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
              {link.label}
              {active ? (
                <motion.span
                  className="absolute right-3 size-2 rounded-full bg-[color:var(--background)]"
                  layoutId="dashboard-active-dot"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4">
        <div className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/8 p-4">
          <div className="text-xs font-semibold tracking-[0.2em] text-[color:var(--gold)] uppercase">
            Live Analytics
          </div>
          <p className="mt-3 text-xs leading-6 text-[color:var(--text-muted)]">
            View current orders and delivered order value in Overview.
          </p>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {!onClose ? (
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block">
          {sidebar}
        </div>
      ) : null}
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            onClick={(event) => event.stopPropagation()}
            className="h-full"
          >
            {sidebar}
          </motion.div>
        </motion.div>
      ) : null}
    </>
  );
}
