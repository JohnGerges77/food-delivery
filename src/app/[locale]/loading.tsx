import { LoadingState } from "@/components/common/LoadingState";
import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("common");

  return <LoadingState message={t("loading")} />;
}
