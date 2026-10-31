export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  oldPrice?: number;
  image: string;
  images: string[];
  categoryId: string;
  isAvailable: boolean;
  isFeatured: boolean;
  preparationTime: number;
  rating: number;
  calories?: number;
};
