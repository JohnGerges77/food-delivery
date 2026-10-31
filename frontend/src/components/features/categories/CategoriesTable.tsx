import { CategoryRow } from "@/components/features/categories/CategoryRow";
import type { Category } from "@/types";

export function CategoriesTable({ categories }: { categories: Category[] }) {
  return (
    <div className="grid gap-3">
      {categories.map((category) => (
        <CategoryRow category={category} key={category.id} />
      ))}
    </div>
  );
}
