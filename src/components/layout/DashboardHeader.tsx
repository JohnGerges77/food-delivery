import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

export function DashboardHeader() {
  const t = useTranslations("navigation");

  return (
    <header className="border-b border-zinc-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <Link className="font-semibold text-zinc-950" href={routes.dashboard}>
          {t("dashboardBrand")}
        </Link>
        <Link className="text-sm text-zinc-600" href={routes.home}>
          {t("viewStorefront")}
        </Link>
      </div>
    </header>
  );
}
