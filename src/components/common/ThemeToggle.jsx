"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle({ className = "" }) {
  const { isLight, toggleTheme } = useTheme();
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      aria-label={label}
      className={`group inline-grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-[color:var(--border)] bg-[color:var(--glass)] text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--primary)]/60 hover:text-[color:var(--primary)] hover:shadow-[0_0_28px_rgba(255,122,0,0.24)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--primary)] ${className}`}
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      {isLight ? (
        <Sun aria-hidden="true" className="size-[1.15rem] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
      ) : (
        <Moon aria-hidden="true" className="size-[1.15rem] transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
      )}
    </button>
  );
}

export default ThemeToggle;
