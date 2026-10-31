import { StorefrontView } from "@/components/features/storefront/StorefrontView";
export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <StorefrontView page="product" productId={productId} />;
}
