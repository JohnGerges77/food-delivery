"use client";

import { Button } from "@/components/common/Button";
import type { Category } from "@/types";

export function CategoryFilter({
  categories,
  activeCategoryId,
  onChange,
}: {
  categories: Category[];
  activeCategoryId?: string;
  onChange?: (categoryId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <Button
          key={category.id}
          variant={activeCategoryId === category.id ? "primary" : "secondary"}
          onClick={() => onChange?.(category.id)}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
}
