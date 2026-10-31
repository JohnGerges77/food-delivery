import { Input } from "@/components/common/Input";
import { Textarea } from "@/components/common/Textarea";
import { useTranslations } from "next-intl";

export function DeliveryDetails() {
  const t = useTranslations("forms");

  return (
    <div className="grid gap-4">
      <Input placeholder={t("deliveryPhone")} />
      <Textarea placeholder={t("deliveryAddress")} />
    </div>
  );
}
