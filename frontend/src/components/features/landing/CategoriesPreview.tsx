import { Badge } from "@/components/common/Badge";
import type { Category } from "@/types";

export function CategoriesPreview({ categories }: { categories: Category[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <Badge key={category.id}>{category.name}</Badge>
      ))}
    </div>
  );
}
