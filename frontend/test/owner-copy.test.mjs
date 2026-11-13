import assert from 'node:assert/strict';
import test from 'node:test';
import { chartSummary, chartTotalOrders, missingImageLabel, ownerText, productFeedback, productImageLabel } from '../src/components/features/dashboard/owner-copy.ts';

test('owner interface copy is localized while English and unknown content are preserved', () => {
  assert.equal(ownerText('ar', 'Additional Image URLs — one per line'), 'روابط الصور الإضافية — رابط في كل سطر');
  assert.equal(ownerText('ar', 'Calories'), 'السعرات الحرارية');
  assert.equal(ownerText('en', 'Delete Product'), 'Delete Product');
  assert.equal(ownerText('ar', 'اسم صاحب المطعم'), 'اسم صاحب المطعم');
  assert.match(ownerText('ar', 'Enter 0–1,000,000 with up to 2 decimal places.'), /2/);
  assert.equal(productFeedback('ar', 'Original Name', 'updated'), 'تم تعديل Original Name.');
});

test('accessible dynamic labels are localized without translating restaurant data', () => {
  assert.equal(productImageLabel('ar', 'Pizza', 2), 'صورة Pizza 2');
  assert.equal(missingImageLabel('ar', 'Pizza'), 'Pizza: لا توجد صورة');
  assert.equal(chartTotalOrders('ar', '12'), 'إجمالي الطلبات: 12');
  assert.equal(chartSummary('ar', 3, 'week', 'طلبات: 5'), '3 فترات أسبوعية بتوقيت UTC. طلبات: 5');
  assert.equal(chartTotalOrders('en', '12'), '12 total orders');
});

test('owner login messages and navigation controls have Arabic equivalents', () => {
  for (const text of ['Manage Orders', 'Update Menu Items', 'Track Restaurant Activity', 'Orders Processed', 'Menu Items', 'Restaurant Rating', 'Email', 'Password', 'Show password', 'Hide password', 'Signing in…', 'Login', 'Enter a valid email and password.', 'Too many attempts. Please try again later.', 'Cannot reach the server. Please try again.', 'Unable to sign in. Check your credentials and try again.', 'Switch to dark mode', 'Switch to light mode']) {
    assert.notEqual(ownerText('ar', text), text, text);
    assert.equal(ownerText('en', text), text, text);
  }
});
