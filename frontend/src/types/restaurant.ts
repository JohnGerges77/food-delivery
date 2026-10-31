export type Restaurant = {
  name: string;
  description: string;
  phone: string;
  address: string;
  openingHours: string;
  deliveryFee: number;
  minimumOrder: number;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
  };
};
