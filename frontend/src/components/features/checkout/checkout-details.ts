export type CheckoutDetails = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes: string;
};

export const emptyCheckoutDetails: CheckoutDetails = {
  fullName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  notes: "",
};

export function updateCheckoutDetail(
  current: CheckoutDetails,
  field: keyof CheckoutDetails,
  value: string,
): CheckoutDetails {
  return { ...current, [field]: value };
}
