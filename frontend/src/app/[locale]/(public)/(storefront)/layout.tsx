import { StorefrontLayout } from "@/components/features/storefront/StorefrontView";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StorefrontLayout>{children}</StorefrontLayout>;
}
