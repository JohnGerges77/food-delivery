import { StorefrontLayout } from "@/components/features/storefront/StorefrontView";

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StorefrontLayout slug={slug}>{children}</StorefrontLayout>;
}
