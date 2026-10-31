"use client";

import { ErrorState } from "@/components/common/ErrorState";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  return (
    <ErrorState
      title={t("somethingWentWrong")}
      message={error.message || t("errorDescription")}
      actionLabel={t("tryAgain")}
      onAction={reset}
    />
  );
}
