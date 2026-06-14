import { useTranslations } from "next-intl";

export function PublicFooter() {
  const t = useTranslations("components");
  const navigation = useTranslations("navigation");

  return (
    <footer className="border-t border-zinc-200 bg-white px-6 py-4 text-sm text-zinc-600">
      <div className="mx-auto max-w-6xl">
        {t("starterFooter", { restaurantName: navigation("brand") })}
      </div>
    </footer>
  );
}
