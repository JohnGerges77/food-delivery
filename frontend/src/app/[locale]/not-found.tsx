import { EmptyState } from "@/components/common/EmptyState";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("common");

  return (
    <EmptyState
      title={t("pageNotFound")}
      description={t("pageNotFoundDescription")}
      action={<Link href="/">{t("returnHome")}</Link>}
    />
  );
}
