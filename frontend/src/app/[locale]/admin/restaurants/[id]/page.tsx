import { AdminRestaurantDetails } from "@/components/features/platform-admin/AdminRestaurantDetails";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminRestaurantDetails id={id} />;
}
