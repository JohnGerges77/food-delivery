"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Edit3, Eye, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
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

type EditableProduct = Product & { status?: "Available" | "Unavailable" };

const emptyProduct = {
  name: "",
  categoryId: "cat-burgers",
  price: 0,
  description: "",
  image: "/main.png",
  isAvailable: true,
};

export function DashboardProductsPage({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [items, setItems] = useState<EditableProduct[]>(
    products.map((product) => ({
      ...product,
      status: product.isAvailable ? "Available" : "Unavailable",
    })),
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingProduct, setEditingProduct] = useState<EditableProduct | null>(null);
  const [form, setForm] = useState(emptyProduct);

  const categoryMap = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return items.filter((product) => {
      const matchesCategory = category === "all" || product.categoryId === category;
      const matchesQuery =
        !normalized ||
        [product.name, product.description, categoryMap.get(product.categoryId)]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return matchesCategory && matchesQuery;
    });
  }, [category, categoryMap, items, query]);

  function openAddModal() {
    setForm(emptyProduct);
    setEditingProduct(null);
    setModalMode("add");
  }

  function openEditModal(product: EditableProduct) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      categoryId: product.categoryId,
      price: product.price,
      description: product.description,
      image: product.image,
      isAvailable: product.isAvailable,
    });
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingProduct(null);
  }

  function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (modalMode === "edit" && editingProduct) {
      setItems((current) =>
        current.map((product) =>
          product.id === editingProduct.id
            ? {
                ...product,
                ...form,
                price: Number(form.price),
                images: [form.image],
                status: form.isAvailable ? "Available" : "Unavailable",
              }
            : product,
        ),
      );
    } else {
      const id = `prod-local-${Date.now()}`;
      setItems((current) => [
        {
          id,
          slug: form.name.toLowerCase().replaceAll(" ", "-") || id,
          oldPrice: undefined,
          images: [form.image],
          isFeatured: false,
          preparationTime: 18,
          rating: 4.7,
          calories: 640,
          ...form,
          price: Number(form.price),
          status: form.isAvailable ? "Available" : "Unavailable",
        },
        ...current,
      ]);
    }

    closeModal();
  }

  return (
    <section>
      <DashboardPageHeader
        eyebrow="Menu Operations"
        title="Product Management"
        description="Manage the Savora menu catalog with frontend-only local state, ready for future Node.js APIs."
        action={
          <ActionButton onClick={openAddModal}>
            <Plus aria-hidden="true" size={16} />
            Add Product
          </ActionButton>
        }
      />

      <DashboardCard className="p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search products by name, category, flavor..."
          />
          <select
            className={`${inputClass} appearance-none`}
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option className="bg-[color:var(--background)]" value="all">
              All Categories
            </option>
            {categories.map((item) => (
              <option className="bg-[color:var(--background)]" key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </DashboardCard>

      <div className="mt-6 grid gap-4">
        <div className="hidden overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] xl:block">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold tracking-[0.16em] text-[color:var(--gold)] uppercase">
              <tr className="border-b border-white/10">
                <th className="px-5 py-4">Product</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Price</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Rating</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="text-[color:var(--text-muted)]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative size-14 overflow-hidden rounded-xl">
                        <Image
                          alt={product.name}
                          className="object-cover"
                          fill
                          sizes="3.5rem"
                          src={product.image}
                        />
                      </div>
                      <div>
                        <div className="font-semibold text-[color:var(--text)]">
                          {product.name}
                        </div>
                        <div className="line-clamp-1 max-w-md text-xs">
                          {product.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">{categoryMap.get(product.categoryId)}</td>
                  <td className="px-5 py-4 text-[color:var(--primary-light)]">
                    {formatCurrency(product.price)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={product.isAvailable ? "Available" : "Unavailable"} />
                  </td>
                  <td className="px-5 py-4">{product.rating}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <ActionButton variant="ghost" className="min-h-10 px-3">
                        <Eye aria-hidden="true" size={15} />
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        className="min-h-10 px-3"
                        onClick={() => openEditModal(product)}
                      >
                        <Edit3 aria-hidden="true" size={15} />
                      </ActionButton>
                      <ActionButton
                        variant="danger"
                        className="min-h-10 px-3"
                        onClick={() =>
                          setItems((current) =>
                            current.filter((item) => item.id !== product.id),
                          )
                        }
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 xl:hidden">
          {filteredProducts.map((product, index) => (
            <motion.article
              className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.078),rgba(255,255,255,0.028)_60%,rgba(255,122,0,0.04))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
              key={product.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.45, ease: dashboardEase }}
            >
              <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
                <div className="relative aspect-square overflow-hidden rounded-xl">
                  <Image
                    alt={product.name}
                    className="object-cover"
                    fill
                    sizes="6rem"
                    src={product.image}
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">{product.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                        {product.description}
                      </p>
                    </div>
                    <StatusBadge status={product.isAvailable ? "Available" : "Unavailable"} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[color:var(--text-muted)]">
                    <span>{categoryMap.get(product.categoryId)}</span>
                    <span>{formatCurrency(product.price)}</span>
                    <span>Rating {product.rating}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton variant="ghost" className="min-h-10">
                      View
                    </ActionButton>
                    <ActionButton
                      variant="ghost"
                      className="min-h-10"
                      onClick={() => openEditModal(product)}
                    >
                      Edit
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      className="min-h-10"
                      onClick={() =>
                        setItems((current) => current.filter((item) => item.id !== product.id))
                      }
                    >
                      Delete
                    </ActionButton>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>

      <AnimatePresence>
        <DashboardModal
          open={modalMode !== null}
          title={modalMode === "edit" ? "Edit Product" : "Add Product"}
          onClose={closeModal}
        >
          <form className="grid gap-4" onSubmit={submitProduct}>
            <label>
              <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                Product Name
              </span>
              <input
                className={inputClass}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Category
                </span>
                <select
                  className={`${inputClass} appearance-none`}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                  value={form.categoryId}
                >
                  {categories.map((item) => (
                    <option className="bg-[color:var(--background)]" key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Price
                </span>
                <input
                  className={inputClass}
                  min="0"
                  onChange={(event) =>
                    setForm({ ...form, price: Number(event.target.value) })
                  }
                  required
                  step="0.01"
                  type="number"
                  value={form.price}
                />
              </label>
            </div>
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
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <span>
                <span className="block font-semibold">Availability</span>
                <span className="text-sm text-[color:var(--text-muted)]">
                  Show this item as orderable on the menu.
                </span>
              </span>
              <input
                checked={form.isAvailable}
                className="size-5 accent-[color:var(--primary)]"
                onChange={(event) =>
                  setForm({ ...form, isAvailable: event.target.checked })
                }
                type="checkbox"
              />
            </label>
            <div className="flex justify-end gap-3">
              <ActionButton variant="ghost" onClick={closeModal}>
                Cancel
              </ActionButton>
              <ActionButton type="submit">Save Product</ActionButton>
            </div>
          </form>
        </DashboardModal>
      </AnimatePresence>
    </section>
  );
}
