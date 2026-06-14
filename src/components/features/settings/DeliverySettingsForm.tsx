import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import type { Restaurant } from "@/types";
import { useTranslations } from "next-intl";

export function DeliverySettingsForm({ restaurant }: { restaurant: Restaurant }) {
  const t = useTranslations("forms");

  return (
    <form className="grid gap-4">
      <Input defaultValue={restaurant.deliveryFee} type="number" />
      <Input defaultValue={restaurant.minimumOrder} type="number" />
      <Button type="submit">{t("saveDeliverySettings")}</Button>
    </form>
  );
}
