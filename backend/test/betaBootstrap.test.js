import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { checkUri, checkManifest, plan } from '../src/cli/beta-bootstrap-dry-run.js';
const collections = checkManifest(JSON.parse(await readFile(new URL('../../docs/public-beta-index-manifest.json', import.meta.url))));
test('only isolated beta URI and safe options pass', () => {
  checkUri('mongodb+srv://savora_beta_user:placeholder@cluster.example/savora_beta');
  for (const value of [undefined,'mongodb+srv://savora_staging_user:p@x.example/savora_beta', ...['savora_staging','savora_test','savora_dev'].map(db=>`mongodb+srv://savora_beta_user:p@x.example/${db}`),'mongodb+srv://savora_beta_user:p@x.example/savora_beta?tlsInsecure=true']) assert.throws(()=>checkUri(value));
});
test('empty database reports every operation without executing DDL', async () => {
  const db={listCollections:()=>({toArray:async()=>[]}),collection:()=>assert.fail('unexpected access')};
  const operations=await plan(db,collections);
  assert.equal(operations.filter(o=>o.action==='createCollection').length,9);
  assert.equal(operations.filter(o=>o.action==='createIndex').length,19);
});
test('records, unknown collections and changed manifest fail closed', async () => {
  await assert.rejects(plan({listCollections:()=>({toArray:async()=>[{name:'other'}]})},collections));
  await assert.rejects(plan({listCollections:()=>({toArray:async()=>[{name:'restaurants'}]}),collection:()=>({findOne:async()=>({_id:1})})},collections));
  assert.throws(()=>checkManifest({database:'savora_beta',collections:[]}));
});
