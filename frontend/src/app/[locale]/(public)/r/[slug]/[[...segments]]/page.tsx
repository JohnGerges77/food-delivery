import { notFound } from "next/navigation";
import { StorefrontView, type StorefrontPage } from "@/components/features/storefront/StorefrontView";

export default async function Page({ params }: { params: Promise<{ slug: string; segments?: string[] }> }) {
  const { slug, segments = [] } = await params;
  const path = segments.join("/");
  const page: StorefrontPage | null = path === "" ? "home" :
    ["menu", "cart", "checkout", "about"].includes(path) ? path as StorefrontPage :
    segments.length === 2 && segments[0] === "menu" ? "product" : null;
  if (!page) notFound();
  return <StorefrontView slug={slug} page={page} productId={page === "product" ? segments[1] : undefined} />;
}
