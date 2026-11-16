import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Product from '../src/models/Product.js';
import { parseProductInput, InvalidProductInput } from '../src/services/ownerProducts.js';
import { parseCheckout } from '../src/services/guestCheckout.js';

test('variants validate identifiers, names, price precision and order', async () => {
  const v = { name:'Small', price:15.25, isAvailable:true, sortOrder:0 };
  assert.equal(parseProductInput({variants:[v]}).variants[0].price,15.25);
  for (const value of [{...v,price:-1},{...v,price:1.001},{...v,name:' '},{...v,sortOrder:-1}]) assert.throws(()=>parseProductInput({variants:[value]}),InvalidProductInput);
  const id=String(new mongoose.Types.ObjectId());
  assert.throws(()=>parseProductInput({variants:[{...v,id},{...v,id}]}),InvalidProductInput);
  const p=new Product({restaurantId:new mongoose.Types.ObjectId(),categoryId:new mongoose.Types.ObjectId(),name:'Pizza',slug:'pizza',price:10,variants:[v]});
  await p.validate(); const variantId=String(p.variants[0]._id); p.variants[0].name='Renamed'; p.variants[0].price=20;
  await p.validate(); assert.equal(String(p.variants[0]._id),variantId);
});

test('checkout distinguishes variants and preserves legacy normalized input', () => {
  const productId=String(new mongoose.Types.ObjectId()), variantId=String(new mongoose.Types.ObjectId());
  const base={customerName:'A',customerPhone:'+201001234567',deliveryAddress:'Test',city:'Cairo',submissionMethod:'direct'};
  const key='a'.repeat(32);
  const legacy=parseCheckout({...base,items:[{productId,quantity:1}]},key);
  assert.equal(Object.hasOwn(legacy.items[0],'variantId'),false);
  assert.equal(parseCheckout({...base,items:[{productId,quantity:1},{productId,variantId,quantity:2}]},key).items.length,2);
  assert.throws(()=>parseCheckout({...base,items:[{productId,variantId,quantity:1},{productId,variantId,quantity:2}]},key));
});
