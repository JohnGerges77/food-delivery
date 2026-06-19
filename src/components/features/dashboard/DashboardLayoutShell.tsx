"use client";

import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { usePathname } from "@/i18n/navigation";

export function DashboardLayoutShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/dashboard/login") {
    return children;
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--text)]">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_82%_8%,rgba(255,122,0,0.14),transparent_30%),radial-gradient(circle_at_15%_92%,rgba(212,160,23,0.1),transparent_34%),linear-gradient(135deg,rgba(13,13,13,1),rgba(31,31,31,0.72)_48%,rgba(13,13,13,1))]" />
      <DashboardSidebar />
      <AnimatePresence>
        <DashboardSidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      </AnimatePresence>
      <DashboardHeader onMenuClick={() => setMenuOpen(true)} />
      <main className="px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
