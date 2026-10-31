import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import type { Restaurant } from "@/types";
import { useTranslations } from "next-intl";

export function OpeningHoursForm({ restaurant }: { restaurant: Restaurant }) {
  const t = useTranslations("forms");

  return (
    <form className="grid gap-4">
      <Input defaultValue={restaurant.openingHours} />
      <Button type="submit">{t("saveOpeningHours")}</Button>
    </form>
  );
}
