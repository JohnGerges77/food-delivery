"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Edit3, FolderOpen, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { Category, Product } from "@/types";
import {
  ActionButton,
  DashboardCard,
  DashboardModal,
  DashboardPageHeader,
  SearchInput,
  StatusBadge,
  dashboardEase,
  inputClass,
  textareaClass,
} from "./DashboardUI";

type EditableCategory = Category & { status: "Active" | "Hidden" };

const emptyCategory: Pick<EditableCategory, "name" | "description" | "image" | "status"> = {
  name: "",
  description: "",
  image: "/main.png",
  status: "Active",
};

export function DashboardCategoriesPage({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const [items, setItems] = useState<EditableCategory[]>(
    categories.map((category) => ({ ...category, status: "Active" })),
  );
  const [query, setQuery] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingCategory, setEditingCategory] = useState<EditableCategory | null>(null);
  const [form, setForm] = useState(emptyCategory);

  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return items.filter(
      (category) =>
        !normalized ||
        [category.name, category.description].join(" ").toLowerCase().includes(normalized),
    );
  }, [items, query]);

  function productCount(categoryId: string) {
    return products.filter((product) => product.categoryId === categoryId).length;
  }

  function openAddModal() {
    setForm(emptyCategory);
    setEditingCategory(null);
    setModalMode("add");
  }

  function openEditModal(category: EditableCategory) {
    setEditingCategory(category);
    setForm({
      name: category.name,
      description: category.description,
      image: category.image,
      status: category.status,
    });
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingCategory(null);
  }

  function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (modalMode === "edit" && editingCategory) {
      setItems((current) =>
        current.map((category) =>
          category.id === editingCategory.id ? { ...category, ...form } : category,
        ),
      );
    } else {
      const id = `cat-local-${Date.now()}`;
      setItems((current) => [
        {
          id,
          slug: form.name.toLowerCase().replaceAll(" ", "-") || id,
          ...form,
        },
        ...current,
      ]);
    }

    closeModal();
  }

  return (
    <section>
      <DashboardPageHeader
        eyebrow="Menu Structure"
        title="Category Management"
        description="Organize menu sections, visibility, descriptions, and future API-ready category records."
        action={
          <ActionButton onClick={openAddModal}>
            <Plus aria-hidden="true" size={16} />
            Add Category
          </ActionButton>
        }
      />

      <DashboardCard className="p-4 sm:p-5">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search categories by name or description..."
        />
      </DashboardCard>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredCategories.map((category, index) => (
          <motion.article
            className="group relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.078),rgba(255,255,255,0.028)_60%,rgba(255,122,0,0.04))] shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl"
            key={category.id}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.5, ease: dashboardEase }}
          >
            <div className="relative aspect-[1.9] overflow-hidden">
              <Image
                alt={category.name}
                className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                fill
                sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                src={category.image}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-black/15 to-black/10" />
              <div className="absolute left-4 top-4">
                <StatusBadge status={category.status} />
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold">{category.name}</h3>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                    {category.description}
                  </p>
                </div>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]">
                  <FolderOpen aria-hidden="true" size={20} />
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <span className="text-sm text-[color:var(--text-muted)]">Products</span>
                <span className="font-semibold text-[color:var(--primary-light)]">
                  {productCount(category.id)}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <ActionButton
                  variant="ghost"
                  className="min-h-10"
                  onClick={() => openEditModal(category)}
                >
                  <Edit3 aria-hidden="true" size={15} />
                  Edit
                </ActionButton>
                <ActionButton
                  variant="danger"
                  className="min-h-10"
                  onClick={() =>
                    setItems((current) => current.filter((item) => item.id !== category.id))
                  }
                >
                  <Trash2 aria-hidden="true" size={15} />
                  Delete
                </ActionButton>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <AnimatePresence>
        <DashboardModal
          open={modalMode !== null}
          title={modalMode === "edit" ? "Edit Category" : "Add Category"}
          onClose={closeModal}
        >
          <form className="grid gap-4" onSubmit={submitCategory}>
            <label>
              <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                Category Name
              </span>
              <input
                className={inputClass}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                Description
              </span>
              <textarea
                className={textareaClass}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                required
                value={form.description}
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                Image URL
              </span>
              <input
                className={inputClass}
                onChange={(event) => setForm({ ...form, image: event.target.value })}
                required
                value={form.image}
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                Status
              </span>
              <select
                className={`${inputClass} appearance-none`}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as "Active" | "Hidden" })
                }
                value={form.status}
              >
                <option className="bg-[color:var(--background)]" value="Active">
                  Active
                </option>
                <option className="bg-[color:var(--background)]" value="Hidden">
                  Hidden
                </option>
              </select>
            </label>
            <div className="flex justify-end gap-3">
              <ActionButton variant="ghost" onClick={closeModal}>
                Cancel
              </ActionButton>
              <ActionButton type="submit">Save Category</ActionButton>
            </div>
          </form>
        </DashboardModal>
      </AnimatePresence>
    </section>
  );
}
