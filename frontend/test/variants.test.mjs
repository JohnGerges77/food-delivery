import assert from 'node:assert/strict';
import { test } from 'node:test';
import { useCartStore } from '../src/store/cart-store.ts';
import { cartItemKey } from '../src/lib/cart-identity.ts';
import { productDisplayPrice } from '../src/lib/public-menu-presentation.ts';
import { buildCheckoutPayload } from '../src/services/guest-checkout-service.ts';

test('variant cart lines stay separate, reject missing selection and send identifiers without prices', () => {
  const product={id:'507f1f77bcf86cd799439011',name:'Pizza',price:1,imageUrl:'',variants:[{id:'507f1f77bcf86cd799439012',name:'Small',price:20,isAvailable:true,sortOrder:0},{id:'507f1f77bcf86cd799439013',name:'Large',price:30,isAvailable:true,sortOrder:1}]};
  const store=useCartStore.getState();store.clearCart();store.setTenant('test');
  store.addPublicItem('test',product);assert.equal(useCartStore.getState().items.length,0);
  store.addPublicItem('test',product,1,product.variants[0].id);store.addPublicItem('test',product,2,product.variants[1].id);
  assert.equal(useCartStore.getState().items.length,2);assert.equal(useCartStore.getState().getSubtotal(),80);
  store.increaseQuantity(cartItemKey(useCartStore.getState().items[0]));assert.equal(useCartStore.getState().items[1].quantity,2);
  const payload=buildCheckoutPayload({fullName:'A',phone:'+201001234567',address:'Test',city:'Cairo',notes:''},useCartStore.getState().items,'whatsapp');
  assert.equal(payload.items[1].variantId,product.variants[1].id);assert.equal(Object.hasOwn(payload.items[1],'price'),false);
  assert.match(productDisplayPrice(product,'EGP','en'),/Starting from.*20/);
  store.clearCart();
});
