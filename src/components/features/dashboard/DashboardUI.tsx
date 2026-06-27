"use client";

import { motion } from "framer-motion";
import { Search, X } from "lucide-react";

export const dashboardEase = [0.16, 1, 0.3, 1] as const;

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      className="mb-6 flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025)_58%,rgba(255,122,0,0.04))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.065)] backdrop-blur-xl sm:p-6 lg:flex-row lg:items-end lg:justify-between"
      initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.62, ease: dashboardEase }}
    >
      <div>
        <div className="text-xs font-semibold tracking-[0.22em] text-[color:var(--gold)] uppercase">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-3xl font-semibold leading-tight text-balance sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </motion.div>
  );
}

export function DashboardCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.078),rgba(255,255,255,0.028)_60%,rgba(255,122,0,0.04))] shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl ${className}`}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, ease: dashboardEase }}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 size-52 rounded-full bg-[color:var(--primary)]/10 blur-3xl" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

export function ActionButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const classes = {
    primary:
      "bg-[linear-gradient(135deg,var(--primary),var(--primary-light))] text-[color:var(--background)] shadow-[0_16px_42px_rgba(255,122,0,0.3)]",
    ghost:
      "border border-white/12 bg-white/[0.045] text-[color:var(--text)] hover:border-[color:var(--primary)]/45 hover:text-[color:var(--primary-light)]",
    danger:
      "border border-red-400/25 bg-red-500/10 text-red-200 hover:border-red-300/45",
  };

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${classes[variant]} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search
        aria-hidden="true"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--primary-light)]"
        size={17}
      />
      <input
        className="h-12 w-full rounded-full border border-white/10 bg-white/[0.045] pl-11 pr-10 text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-muted)]/55 focus:border-[color:var(--primary)]/60 focus:shadow-[0_0_0_4px_rgba(255,122,0,0.12)]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      {value ? (
        <button
          aria-label="Clear search"
          className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--text-muted)] hover:bg-white/[0.08] hover:text-[color:var(--primary-light)]"
          onClick={() => onChange("")}
          type="button"
        >
          <X aria-hidden="true" size={14} />
        </button>
      ) : null}
    </label>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "cancelled" || normalized.includes("unavailable")
      ? "border-red-400/25 bg-red-500/10 text-red-200"
      : normalized.includes("available") || normalized === "delivered" || normalized === "ready"
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
        : normalized === "pending"
        ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
        : normalized === "preparing"
          ? "border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]"
          : normalized.includes("delivery")
            ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
            : "border-white/12 bg-white/[0.045] text-[color:var(--text-muted)]";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${styles}`}>
      {status.replaceAll("-", " ")}
    </span>
  );
}

export function DashboardModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-3 backdrop-blur-md sm:place-items-center sm:p-6"
      data-lenis-prevent
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-[1.4rem] border border-white/12 bg-[linear-gradient(145deg,rgba(31,31,31,0.98),rgba(13,13,13,0.98)_58%,rgba(255,122,0,0.07))] p-5 shadow-[0_42px_140px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-6"
        initial={{ opacity: 0, scale: 0.94, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        transition={{ duration: 0.28, ease: dashboardEase }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-2xl font-semibold">{title}</h3>
          <button
            aria-label="Close modal"
            className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[color:var(--text-muted)] hover:text-[color:var(--primary-light)]"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export const inputClass =
  "h-12 w-full rounded-[1rem] border border-white/10 bg-[color:var(--background)]/62 px-4 text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-muted)]/48 focus:border-[color:var(--primary)]/70 focus:shadow-[0_0_0_4px_rgba(255,122,0,0.13)]";

export const textareaClass =
  "min-h-28 w-full resize-none rounded-[1rem] border border-white/10 bg-[color:var(--background)]/62 px-4 py-3 text-sm leading-7 text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-muted)]/48 focus:border-[color:var(--primary)]/70 focus:shadow-[0_0_0_4px_rgba(255,122,0,0.13)]";
