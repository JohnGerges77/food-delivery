import { ApiError, apiRequest } from "./api-client.ts";
import { westernDigits } from "../lib/western-digits.ts";
import { normalizeStorefrontAccent } from "../lib/storefront-accent.ts";

export interface OwnerRestaurant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  status: "active" | "suspended";
  storefrontTheme?: string;
  onlineOrderingEnabled?: boolean;
  heroProductId: string | null;
  description: string | null;
  logoUrl: string | null;
  aboutImageUrl?: string | null;
  heroImageUrl?: string | null;
  phone: string | null;
  contactEmail: string | null;
  address: string | null;
  openingHours: string | null;
  deliverySettings: {
    deliveryFee: number | null;
    minimumOrder: number | null;
    estimatedDeliveryTime: string | null;
    deliveryAvailable: boolean;
    whatsappOrderingEnabled: boolean;
  };
  socialLinks: { facebook: string | null; instagram: string | null; whatsapp: string | null };
  branding: { brandName: string | null; primaryColor: string | null };
}

export interface RestaurantSettingsForm {
  name: string;
  heroProductId: string;
  description: string;
  logoUrl: string;
  aboutImageUrl: string;
  heroImageUrl: string;
  phone: string;
  contactEmail: string;
  address: string;
  openingHours: string;
  deliveryFee: string;
  minimumOrder: string;
  estimatedDeliveryTime: string;
  deliveryAvailable: boolean;
  whatsappOrderingEnabled: boolean;
  facebook: string;
  instagram: string;
  whatsapp: string;
  brandName: string;
  primaryColor: string;
}

export type RestaurantSettingsPatch = Partial<Pick<OwnerRestaurant,
  "name" | "heroProductId" | "description" | "logoUrl" | "aboutImageUrl" | "heroImageUrl" | "phone" | "contactEmail" | "address" | "openingHours">> & {
  deliverySettings?: Partial<OwnerRestaurant["deliverySettings"]>;
  socialLinks?: Partial<OwnerRestaurant["socialLinks"]>;
  branding?: Partial<OwnerRestaurant["branding"]>;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function nullableAmount(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

export function normalizeWhatsAppSetting(value: string): string | null {
  const trimmed = westernDigits(value.trim());
  if (!trimmed) return "";
  if (trimmed.length > 80) return null;
  const link = /^https:\/\/wa\.me\/([0-9]+)\/?$/i.exec(trimmed);
  const phone = /^\+[1-9][0-9 ()-]+$/.test(trimmed) ? trimmed.replace(/[+ ()-]/g, "") : null;
  const digits = link?.[1] ?? phone;
  return digits && /^[1-9][0-9]{6,14}$/.test(digits) ? "https://wa.me/" + digits : null;
}

export function parseOwnerRestaurant(value: unknown): OwnerRestaurant {
  if (!record(value) || !record(value.deliverySettings) || !record(value.socialLinks) || !record(value.branding) ||
      ![value.id, value.name, value.slug, value.currency].every((field) => typeof field === "string" && field.length > 0) ||
      !(value.heroProductId === undefined || value.heroProductId === null ||
        (typeof value.heroProductId === "string" && /^[0-9a-fA-F]{24}$/.test(value.heroProductId))) ||
      !(value.heroImageUrl === undefined || nullableString(value.heroImageUrl)) ||
      !(value.storefrontTheme === undefined || typeof value.storefrontTheme === "string") ||
      !(value.onlineOrderingEnabled === undefined || typeof value.onlineOrderingEnabled === "boolean") ||
      ![value.description, value.logoUrl, value.phone, value.contactEmail, value.address, value.openingHours,
        value.deliverySettings.estimatedDeliveryTime, value.socialLinks.facebook, value.socialLinks.instagram,
        value.socialLinks.whatsapp, value.branding.brandName, value.branding.primaryColor].every(nullableString) ||
      ![value.deliverySettings.deliveryFee, value.deliverySettings.minimumOrder].every(nullableAmount) ||
      typeof value.deliverySettings.deliveryAvailable !== "boolean" ||
      !(value.deliverySettings.whatsappOrderingEnabled === undefined || typeof value.deliverySettings.whatsappOrderingEnabled === "boolean") ||
      !["active", "suspended"].includes(String(value.status))) {
    throw new ApiError(null, "Invalid server response");
  }
  return { ...value, heroProductId: value.heroProductId ?? null, deliverySettings: {
    ...value.deliverySettings, whatsappOrderingEnabled: value.deliverySettings.whatsappOrderingEnabled === true,
  } } as OwnerRestaurant;
}

function parseResponse(value: unknown): OwnerRestaurant {
  if (!record(value)) throw new ApiError(null, "Invalid server response");
  return parseOwnerRestaurant(value.restaurant);
}

export async function getOwnerRestaurant(): Promise<OwnerRestaurant> {
  return parseResponse(await apiRequest<unknown>("/api/owner/restaurant"));
}

export async function patchOwnerRestaurant(patch: RestaurantSettingsPatch): Promise<OwnerRestaurant> {
  return parseResponse(await apiRequest<unknown>("/api/owner/restaurant", {
    method: "PATCH", body: patch, csrf: "session",
  }));
}

export function restaurantToForm(restaurant: OwnerRestaurant): RestaurantSettingsForm {
  return {
    name: restaurant.name,
    heroProductId: restaurant.heroProductId ?? "",
    description: restaurant.description ?? "",
    logoUrl: restaurant.logoUrl ?? "",
    aboutImageUrl: restaurant.aboutImageUrl ?? "",
    heroImageUrl: restaurant.heroImageUrl ?? "",
    phone: restaurant.phone ?? "",
    contactEmail: restaurant.contactEmail ?? "",
    address: restaurant.address ?? "",
    openingHours: restaurant.openingHours ?? "",
    deliveryFee: restaurant.deliverySettings.deliveryFee?.toString() ?? "",
    minimumOrder: restaurant.deliverySettings.minimumOrder?.toString() ?? "",
    estimatedDeliveryTime: restaurant.deliverySettings.estimatedDeliveryTime ?? "",
    deliveryAvailable: restaurant.deliverySettings.deliveryAvailable,
    whatsappOrderingEnabled: restaurant.deliverySettings.whatsappOrderingEnabled === true,
    facebook: restaurant.socialLinks.facebook ?? "",
    instagram: restaurant.socialLinks.instagram ?? "",
    whatsapp: restaurant.socialLinks.whatsapp ?? "",
    brandName: restaurant.branding.brandName ?? "",
    primaryColor: restaurant.branding.primaryColor ?? "",
  };
}

export function validateSettingsForm(form: RestaurantSettingsForm, original: OwnerRestaurant): Partial<Record<keyof RestaurantSettingsForm, string>> {
  const errors: Partial<Record<keyof RestaurantSettingsForm, string>> = {};
  for (const key of Object.keys(form) as (keyof RestaurantSettingsForm)[]) {
    const value = form[key];
    if (typeof value === "string" && value.length > 2048) errors[key] = "Use 2048 characters or fewer.";
  }
  if (!form.name.trim()) errors.name = "Restaurant name is required.";
  if (form.heroProductId && !/^[0-9a-fA-F]{24}$/.test(form.heroProductId)) errors.heroProductId = "Select a valid product.";
  if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
    errors.contactEmail = "Enter a valid email address.";
  }
  const whatsappNumberChanged = form.whatsapp !== (original.socialLinks.whatsapp ?? "");
  if (whatsappNumberChanged || (form.whatsappOrderingEnabled && !original.deliverySettings.whatsappOrderingEnabled)) {
    const whatsapp = normalizeWhatsAppSetting(form.whatsapp);
    if (whatsapp === null || (form.whatsappOrderingEnabled && !whatsapp)) {
      errors.whatsapp = "Enter a WhatsApp number with its country code.";
    }
  }
  for (const key of ["logoUrl", "aboutImageUrl", "heroImageUrl", "facebook", "instagram"] as const) {
    const value = form[key].trim();
    const previous = key === "facebook" || key === "instagram" ? original.socialLinks[key] : original[key];
    if (!value || value === (previous ?? "")) continue;
    if (key === "logoUrl" && /^\/api\/public\/restaurants\/[a-z0-9-]+\/media\/[0-9a-f]{24}\/large$/.test(value)) continue;
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
    } catch {
      errors[key] = "Enter a valid HTTP or HTTPS URL without credentials.";
    }
  }
  if (form.primaryColor.trim() && !normalizeStorefrontAccent(form.primaryColor)) {
    errors.primaryColor = "Use a hex color such as #ff7a00.";
  }
  for (const key of ["deliveryFee", "minimumOrder"] as const) {
    const value = form[key].trim();
    if (value === (original.deliverySettings[key]?.toString() ?? "")) continue;
    if (!value) {
      if (original.deliverySettings[key] !== null) errors[key] = "This amount cannot be cleared by the current API.";
    } else if (!/^\d+(?:\.\d{1,2})?$/.test(value) ||
      !Number.isSafeInteger(Math.round(Number(value) * 100))) {
      errors[key] = "Enter a non-negative amount with up to 2 decimal places.";
    }
  }
  return errors;
}

export function settingsPatch(form: RestaurantSettingsForm, original: OwnerRestaurant): RestaurantSettingsPatch {
  const errors = validateSettingsForm(form, original);
  if (Object.keys(errors).length) throw new Error("Invalid settings form");
  const patch: RestaurantSettingsPatch = {};
  if (form.heroProductId !== (original.heroProductId ?? "")) patch.heroProductId = form.heroProductId || null;
  for (const key of ["name", "description", "logoUrl", "aboutImageUrl", "heroImageUrl", "phone", "contactEmail", "address", "openingHours"] as const) {
    const value = form[key].trim();
    if (value !== (original[key] ?? "")) patch[key] = value;
  }
  const delivery: NonNullable<RestaurantSettingsPatch["deliverySettings"]> = {};
  for (const key of ["deliveryFee", "minimumOrder"] as const) {
    const value = form[key].trim();
    if (value && Number(value) !== original.deliverySettings[key]) delivery[key] = Number(value);
  }
  if (form.estimatedDeliveryTime.trim() !== (original.deliverySettings.estimatedDeliveryTime ?? "")) {
    delivery.estimatedDeliveryTime = form.estimatedDeliveryTime.trim();
  }
  if (form.deliveryAvailable !== original.deliverySettings.deliveryAvailable) delivery.deliveryAvailable = form.deliveryAvailable;
  if (form.whatsappOrderingEnabled !== (original.deliverySettings.whatsappOrderingEnabled === true)) {
    delivery.whatsappOrderingEnabled = form.whatsappOrderingEnabled;
  }
  if (Object.keys(delivery).length) patch.deliverySettings = delivery;
  const social: NonNullable<RestaurantSettingsPatch["socialLinks"]> = {};
  for (const key of ["facebook", "instagram"] as const) {
    const value = form[key].trim();
    if (value !== (original.socialLinks[key] ?? "")) social[key] = value;
  }
  if (form.whatsapp !== (original.socialLinks.whatsapp ?? "")) {
    const whatsapp = normalizeWhatsAppSetting(form.whatsapp);
    if (whatsapp !== original.socialLinks.whatsapp) social.whatsapp = whatsapp ?? "";
  }
  if (Object.keys(social).length) patch.socialLinks = social;
  const branding: NonNullable<RestaurantSettingsPatch["branding"]> = {};
  for (const key of ["brandName", "primaryColor"] as const) {
    const value = form[key].trim();
    if (value !== (original.branding[key] ?? "")) branding[key] = value;
  }
  if (Object.keys(branding).length) patch.branding = branding;
  return patch;
}
