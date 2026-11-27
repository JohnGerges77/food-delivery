"use client";

import { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";

function PendingIndicator() {
  const { pending } = useLinkStatus();
  return pending ? <span data-storefront-link-pending aria-hidden="true"
    className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 bg-[color:var(--sf-primary)]" /> : null;
}

export function StorefrontLink({ children, href, prefetch, ...props }: ComponentProps<typeof Link>) {
  const path = typeof href === "string" ? href : href.pathname;
  const productLink = /\/menu\/[a-f\d]{24}(?:[?#]|$)/i.test(path ?? "");
  return <Link {...props} href={href} prefetch={prefetch ?? (productLink ? false : null)}>
    {children}<PendingIndicator />
  </Link>;
}
