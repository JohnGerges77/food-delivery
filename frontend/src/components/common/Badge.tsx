import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700",
        className,
      )}
    >
      {children}
    </span>
  );
}
