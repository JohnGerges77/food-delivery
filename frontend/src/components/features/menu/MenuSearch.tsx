"use client";

import { Input } from "@/components/common/Input";
import { useTranslations } from "next-intl";

export function MenuSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("components");

  return (
    <Input
      placeholder={t("searchMenu")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
