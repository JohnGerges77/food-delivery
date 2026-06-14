"use client";

import { Button } from "@/components/common/Button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { useToggle } from "@/hooks/useToggle";
import { useTranslations } from "next-intl";

export function MobileMenu() {
  const menu = useToggle();
  const t = useTranslations("navigation");

  return (
    <div className="md:hidden">
      <Button variant="secondary" onClick={menu.toggle}>
        {t("openMenu")}
      </Button>
      {menu.value ? (
        <div className="mt-3 grid gap-2 rounded-md border border-zinc-200 bg-white p-3">
          <Link href={routes.menu}>{t("menu")}</Link>
          <Link href={routes.cart}>{t("cart")}</Link>
          <Link href={routes.dashboard}>{t("dashboardBrand")}</Link>
        </div>
      ) : null}
    </div>
  );
}
