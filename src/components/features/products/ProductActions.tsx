"use client";

import { Button } from "@/components/common/Button";
import type { Product } from "@/types";
import { useTranslations } from "next-intl";

export function ProductActions({ product }: { product: Product }) {
  const t = useTranslations("common");

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => undefined}>
        {t("edit")}
      </Button>
      <Button disabled={!product.isAvailable} variant="secondary">
        {product.isAvailable ? t("available") : t("unavailable")}
      </Button>
    </div>
  );
}
