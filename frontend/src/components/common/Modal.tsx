"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/common/Button";
import { useTranslations } from "next-intl";

export function Modal({
  isOpen,
  title,
  children,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const t = useTranslations("common");

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-lenis-prevent>
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-md bg-white p-6 shadow-xl"
        initial={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
          <Button variant="secondary" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </motion.div>
    </div>
  );
}
