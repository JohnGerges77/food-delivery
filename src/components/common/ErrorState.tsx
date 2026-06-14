"use client";

import { Button } from "@/components/common/Button";

export function ErrorState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="m-6 rounded-md border border-red-200 bg-red-50 p-6 text-red-950">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm">{message}</p>
      {actionLabel && onAction ? (
        <Button className="mt-4" variant="danger" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
