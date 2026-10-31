import assert from 'node:assert/strict';
import test from 'node:test';
import Restaurant from '../src/models/Restaurant.js';

const validRestaurant = () => ({
  name: 'Savora',
  slug: 'savora',
  currency: 'EGP',
  openingHours: '10:00 AM - 12:00 AM',
  deliverySettings: {
    deliveryFee: 3,
    minimumOrder: 12,
    estimatedDeliveryTime: '35 - 45 minutes',
  },
  socialLinks: { instagram: 'https://instagram.com/savora' },
  branding: { brandName: 'Savora', primaryColor: '#ff7a00' },
});

async function validationError(document) {
  try {
    await document.validate();
    return null;
  } catch (error) {
    assert.equal(error.name, 'ValidationError');
    return error;
  }
}

test('valid restaurant passes offline validation', async () => {
  await assert.doesNotReject(new Restaurant(validRestaurant()).validate());
});

test('required fields and blank name fail validation', async () => {
  const error = await validationError(new Restaurant());
  for (const field of ['name', 'slug', 'currency']) {
    assert.ok(error.errors[field]);
  }

  const blankName = new Restaurant({ ...validRestaurant(), name: '   ' });
  assert.ok((await validationError(blankName)).errors.name);
});

test('invalid slug formats fail, while uppercase input is normalized', async () => {
  assert.equal(
    Restaurant.schema.path('slug').options.match[0].source,
    '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  );
  for (const slug of ['bad slug', '-bad', 'bad-', 'bad--slug', 'bad_slug']) {
    const restaurant = new Restaurant({ ...validRestaurant(), slug });
    assert.ok((await validationError(restaurant)).errors.slug);
  }

  const normalized = new Restaurant({ ...validRestaurant(), slug: '  Savora-Cairo  ' });
  assert.equal(normalized.slug, 'savora-cairo');
  await assert.doesNotReject(normalized.validate());
});

test('currency is normalized to a three-letter uppercase code', async () => {
  const normalized = new Restaurant({ ...validRestaurant(), currency: ' egp ' });
  assert.equal(normalized.currency, 'EGP');
  await assert.doesNotReject(normalized.validate());

  for (const currency of ['US', 'USDD', 'U1D']) {
    const restaurant = new Restaurant({ ...validRestaurant(), currency });
    assert.ok((await validationError(restaurant)).errors.currency);
  }
});

test('invalid status fails validation', async () => {
  const restaurant = new Restaurant({ ...validRestaurant(), status: 'paused' });
  assert.ok((await validationError(restaurant)).errors.status);
});

test('storefront theme defaults to Classic, accepts four fixed presets and rejects unknown themes', async () => {
  const restaurant = new Restaurant(validRestaurant());
  assert.equal(restaurant.storefrontTheme, 'savora-classic');
  await assert.doesNotReject(restaurant.validate());
  await assert.doesNotReject(new Restaurant({ ...validRestaurant(),
    storefrontTheme: 'savora-aqua' }).validate());
  await assert.doesNotReject(new Restaurant({ ...validRestaurant(),
    storefrontTheme: 'savora-cafe' }).validate());
  await assert.doesNotReject(new Restaurant({ ...validRestaurant(),
    storefrontTheme: 'savora-luxury' }).validate());
  for (const storefrontTheme of ['theme-2', 'savora-luxury-dark']) {
    const unshipped = new Restaurant({ ...validRestaurant(), storefrontTheme });
    assert.ok((await validationError(unshipped)).errors.storefrontTheme);
  }
});

test('delivery fee and minimum order cannot be negative', async () => {
  for (const field of ['deliveryFee', 'minimumOrder']) {
    const restaurant = new Restaurant({
      ...validRestaurant(),
      deliverySettings: { ...validRestaurant().deliverySettings, [field]: -1 },
    });
    assert.ok((await validationError(restaurant)).errors['deliverySettings.' + field]);
  }
});

test('nested fields validate their defined formats', async () => {
  const restaurant = new Restaurant({
    ...validRestaurant(),
    socialLinks: { facebook: 'ftp://example.com', whatsapp: '+201007778899' },
    branding: { primaryColor: 'orange' },
    contactEmail: 'invalid-email',
  });
  const error = await validationError(restaurant);
  assert.ok(error.errors['socialLinks.facebook']);
  assert.ok(error.errors['socialLinks.whatsapp']);
  assert.ok(error.errors['branding.primaryColor']);
  assert.ok(error.errors.contactEmail);
});

test('opening hours text and WhatsApp URL match the frontend representation', async () => {
  const restaurant = new Restaurant({
    ...validRestaurant(),
    openingHours: '  10:00 AM - 12:00 AM  ',
    socialLinks: { whatsapp: 'https://wa.me/201007778899' },
  });
  assert.equal(restaurant.openingHours, '10:00 AM - 12:00 AM');
  await assert.doesNotReject(restaurant.validate());
});

test('defaults and Mongoose timestamp configuration are present', async () => {
  const restaurant = new Restaurant({ name: 'Savora', slug: 'savora', currency: 'EGP' });
  assert.equal(restaurant.status, 'active');
  await assert.doesNotReject(restaurant.validate());

  const withDeliverySettings = new Restaurant({
    name: 'Savora', slug: 'savora', currency: 'EGP', deliverySettings: {},
  });
  assert.equal(withDeliverySettings.deliverySettings.deliveryAvailable, true);
  assert.equal(Restaurant.schema.options.timestamps, true);
  assert.ok(Restaurant.schema.path('createdAt'));
  assert.ok(Restaurant.schema.path('updatedAt'));
});

test('slug has exactly one declared unique index', () => {
  const indexes = Restaurant.schema.indexes();
  assert.equal(indexes.length, 1);
  assert.deepEqual(indexes[0][0], { slug: 1 });
  assert.equal(indexes[0][1].unique, true);
});
