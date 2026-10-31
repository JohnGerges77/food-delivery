import type { Category } from "@/types";

export function CategoryRow({ category }: { category: Category }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <p className="font-medium text-zinc-950">{category.name}</p>
      <p className="mt-1 text-sm text-zinc-600">{category.description}</p>
    </div>
  );
}
