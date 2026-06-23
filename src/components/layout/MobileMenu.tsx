"use client";

import { Button } from "@/components/common/Button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { useToggle } from "@/hooks/useToggle";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export function MobileMenu() {
  const menu = useToggle();
  const t = useTranslations("navigation");

  return (
    <div className="md:hidden">
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={menu.toggle}>
          {t("openMenu")}
        </Button>
        <ThemeToggle />
      </div>
      {menu.value ? (
        <div className="mt-3 grid gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-[color:var(--text)] shadow-[var(--surface-shadow)]">
          <Link href={routes.menu}>{t("menu")}</Link>
          <Link href={routes.cart}>{t("cart")}</Link>
          <Link href={routes.dashboard}>{t("dashboardBrand")}</Link>
        </div>
      ) : null}
    </div>
  );
}
