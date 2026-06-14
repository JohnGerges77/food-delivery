import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Textarea } from "@/components/common/Textarea";
import type { Restaurant } from "@/types";
import { useTranslations } from "next-intl";

export function RestaurantInfoForm({ restaurant }: { restaurant: Restaurant }) {
  const t = useTranslations("forms");

  return (
    <form className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4">
      <Input defaultValue={restaurant.name} />
      <Textarea defaultValue={restaurant.description} />
      <Input defaultValue={restaurant.phone} />
      <Input defaultValue={restaurant.address} />
      <Button type="submit">{t("saveRestaurantInfo")}</Button>
    </form>
  );
}
