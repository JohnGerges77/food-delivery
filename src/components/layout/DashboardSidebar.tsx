import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

const dashboardLinks = [
  { href: routes.dashboard, labelKey: "overview" },
  { href: routes.products, labelKey: "products" },
  { href: routes.categories, labelKey: "categories" },
  { href: routes.orders, labelKey: "orders" },
  { href: routes.settings, labelKey: "settings" },
] as const;

export function DashboardSidebar() {
  const t = useTranslations("navigation");

  return (
    <aside className="hidden min-h-[calc(100vh-65px)] w-64 border-r border-zinc-200 bg-white p-4 md:block">
      <nav className="grid gap-2">
        {dashboardLinks.map((link) => (
          <Link
            className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            href={link.href}
            key={link.href}
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
