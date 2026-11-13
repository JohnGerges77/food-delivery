import { createHash } from 'node:crypto';

// Keep the existing ASCII slug contract even for names in non-Latin scripts.
export function catalogSlugBase(name) {
  const base = name.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/g, '');
  return base || `item-${createHash('sha256').update(name.trim().normalize('NFKC')).digest('hex').slice(0, 12)}`;
}

export function catalogSlugCandidate(base, attempt) {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

export function isSlugConflict(error) {
  return error?.code === 11000 && error.keyPattern?.restaurantId === 1 && error.keyPattern?.slug === 1;
}
