import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Textarea } from "@/components/common/Textarea";
import { useTranslations } from "next-intl";

export function ProductForm() {
  const t = useTranslations("forms");

  return (
    <form className="grid gap-4">
      <Input placeholder={t("productName")} />
      <Textarea placeholder={t("productDescription")} />
      <Input placeholder={t("price")} type="number" />
      <Button type="submit">{t("saveProduct")}</Button>
    </form>
  );
}
