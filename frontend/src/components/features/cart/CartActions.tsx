"use client";

import { Button } from "@/components/common/Button";
import { useTranslations } from "next-intl";

export function CartActions({
  onCheckout,
  onClear,
}: {
  onCheckout?: () => void;
  onClear?: () => void;
}) {
  const t = useTranslations("components");

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onCheckout}>{t("checkout")}</Button>
      <Button variant="outline" onClick={onClear}>
        {t("clearCart")}
      </Button>
    </div>
  );
}
