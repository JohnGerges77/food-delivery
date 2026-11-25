import { restaurantWhatsAppTarget } from './whatsappOrdering.js';

export class OnlineOrderingDisabled extends Error {}

// Records created before the entitlement keep their previous ordering behavior.
export function onlineOrderingEnabled(restaurant) {
  return restaurant.onlineOrderingEnabled !== false;
}

export function effectiveOrdering(restaurant, { checkoutEnabled = true, betaWhatsAppTargets } = {}) {
  const enabled = onlineOrderingEnabled(restaurant);
  const availability = !enabled ? 'menu-only' :
    !checkoutEnabled || restaurant.status === 'suspended' ? 'checkout-disabled' :
      restaurant.deliverySettings?.deliveryAvailable === false ? 'delivery-unavailable' : 'available';
  return { enabled, availability,
    whatsappTarget: availability === 'available' ? restaurantWhatsAppTarget(restaurant, betaWhatsAppTargets) : null };
}
