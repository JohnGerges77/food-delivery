import type { Restaurant } from "@/types";

export function ContactSection({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
      <p>{restaurant.phone}</p>
      <p>{restaurant.address}</p>
      <p>{restaurant.openingHours}</p>
    </div>
  );
}
