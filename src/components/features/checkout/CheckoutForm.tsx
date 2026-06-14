import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Textarea } from "@/components/common/Textarea";
import { useTranslations } from "next-intl";

export function CheckoutForm() {
  const t = useTranslations("forms");

  return (
    <form className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4">
      <Input name="name" placeholder={t("customerName")} />
      <Input name="phone" placeholder={t("phoneNumber")} />
      <Textarea name="address" placeholder={t("deliveryAddress")} />
      <Textarea name="notes" placeholder={t("orderNotes")} />
      <Button type="submit">{t("createMockOrder")}</Button>
    </form>
  );
}
