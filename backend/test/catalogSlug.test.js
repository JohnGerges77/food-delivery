import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogSlugBase, catalogSlugCandidate, isSlugConflict } from '../src/services/catalogSlug.js';

test('catalog slug candidates support Arabic and deterministic collision suffixes', () => {
  assert.equal(catalogSlugBase(' Crème Burger '), 'creme-burger');
  const arabic = catalogSlugBase('وجبات عربية');
  assert.match(arabic, /^item-[a-f0-9]{12}$/);
  assert.equal(catalogSlugBase('وجبات عربية'), arabic);
  assert.equal(catalogSlugCandidate(arabic, 0), arabic);
  assert.equal(catalogSlugCandidate(arabic, 1), `${arabic}-2`);
  assert.equal(isSlugConflict({ code: 11000, keyPattern: { restaurantId: 1, slug: 1 } }), true);
  assert.equal(isSlugConflict({ code: 11000, keyPattern: { email: 1 } }), false);
});
