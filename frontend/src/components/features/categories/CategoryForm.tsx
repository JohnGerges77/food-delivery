import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Textarea } from "@/components/common/Textarea";
import { useTranslations } from "next-intl";

export function CategoryForm() {
  const t = useTranslations("forms");

  return (
    <form className="grid gap-4">
      <Input placeholder={t("categoryName")} />
      <Textarea placeholder={t("categoryDescription")} />
      <Button type="submit">{t("saveCategory")}</Button>
    </form>
  );
}
