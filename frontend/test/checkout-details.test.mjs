import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyCheckoutDetails, updateCheckoutDetail } from "../src/components/features/checkout/checkout-details.ts";

test("each checkout field accepts text without erasing earlier fields", () => {
  const entries = [
    ["fullName", "Aya Hassan"],
    ["phone", "01012345678"],
    ["email", "aya@example.com"],
    ["address", "12 Nile Street"],
    ["city", "Cairo"],
    ["notes", "بدون مكسرات"],
  ];
  let details = emptyCheckoutDetails;
  for (const [field, value] of entries) {
    details = updateCheckoutDetail(details, field, value);
    assert.equal(details[field], value);
  }
  assert.deepEqual(details, Object.fromEntries(entries));
  assert.deepEqual(emptyCheckoutDetails, {
    fullName: "", phone: "", email: "", address: "", city: "", notes: "",
  });
});

test("editing one field preserves the rest across successive state updates", () => {
  const first = updateCheckoutDetail(emptyCheckoutDetails, "fullName", "Aya");
  const second = updateCheckoutDetail(first, "phone", "01012345678");
  const third = updateCheckoutDetail(second, "fullName", "Aya Hassan");
  assert.equal(first.fullName, "Aya");
  assert.equal(second.fullName, "Aya");
  assert.equal(third.fullName, "Aya Hassan");
  assert.equal(third.phone, "01012345678");
  assert.notEqual(third, second);
});
