import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { compareIndexes, declaredApplicationIndexes } from './check-indexes.js';
const manifest = new URL('../../../docs/public-beta-index-manifest.json', import.meta.url);
export function checkUri(value) {
  let u; try { u = new URL(value); } catch { throw Error('Invalid URI'); }
  if (u.protocol !== 'mongodb+srv:' || u.pathname !== '/savora_beta' || decodeURIComponent(u.username) !== 'savora_beta_user' || !u.password || u.hash) throw Error('Wrong beta URI identity');
  const seen = new Set();
  for (const [name,value] of u.searchParams) {
    const key = name.toLowerCase();
    if (seen.has(key) || !['retrywrites','w','appname','authsource','tls'].includes(key) ||
      (key === 'retrywrites' && value !== 'true') || (key === 'w' && value !== 'majority') ||
      (key === 'tls' && value !== 'true') || (key === 'authsource' && !['admin','savora_beta'].includes(value))) throw Error('Unsafe URI options');
    seen.add(key);
  }
}
export function checkManifest(data) {
  const expected = declaredApplicationIndexes();
  if (data.database !== 'savora_beta' || JSON.stringify(data.collections) !== JSON.stringify(expected)) throw Error('Manifest/schema mismatch');
  return data.collections;
}
export async function plan(db, collections) {
  const names = (await db.listCollections({}, {nameOnly:true}).toArray()).map(v => v.name);
  if (names.some(n => !n.startsWith('system.') && !collections.some(c => c.collection === n))) throw Error('Unexpected collection');
  const operations = [];
  for (const c of collections) {
    let existing = [];
    if (!names.includes(c.collection)) operations.push({action:'createCollection',collection:c.collection});
    else {
      const collection = db.collection(c.collection);
      if (await collection.findOne({}, {projection:{_id:1}})) throw Error('Database contains records');
      existing = await collection.listIndexes().toArray();
      if (existing.some(i => i.name !== '_id_' && !c.indexes.some(e => JSON.stringify(e.key) === JSON.stringify(i.key)))) throw Error('Unexpected index');
    }
    for (const index of c.indexes) {
      const findings = compareIndexes([[index.key,index.options]],existing);
      if (findings.some(f => f.issue !== 'missing')) throw Error('Conflicting index');
      if (findings.length) operations.push({action:'createIndex',collection:c.collection,key:index.key,options:index.options});
    }
  }
  return operations;
}
async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 24 || process.argv.length !== 2) throw Error('Node 24, no arguments required');
  const uri = process.env.SAVORA_BETA_BOOTSTRAP_URI; checkUri(uri);
  const collections = checkManifest(JSON.parse(await readFile(manifest,'utf8')));
  const conn = mongoose.createConnection(uri,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:10000});
  try {
    await conn.asPromise();
    if (conn.name !== 'savora_beta' || conn.db.databaseName !== 'savora_beta') throw Error('Database mismatch');
    const result = await conn.db.admin().command({connectionStatus:1});
    const users = result.authInfo?.authenticatedUsers;
    if (!Array.isArray(users) || users.length !== 1 || users[0].user !== 'savora_beta_user' || !['admin','savora_beta'].includes(users[0].db)) throw Error('Authenticated identity mismatch');
    console.log(JSON.stringify({mode:'dry-run',database:'savora_beta',authenticatedUser:'savora_beta_user',operations:await plan(conn.db,collections)},null,2));
  } finally { await conn.close(); }
}
if (import.meta.main) main().catch(() => { console.error('Beta dry-run failed; check identity, network, permissions and fresh database state.'); process.exitCode=1; });
