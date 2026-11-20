import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { checkUri, checkManifest, plan } from './beta-bootstrap-dry-run.js';
async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 24 || process.argv.length !== 2 || process.env.SAVORA_BETA_BOOTSTRAP_APPROVED !== 'savora_beta' || !/^[a-f0-9]{64}$/.test(process.env.SAVORA_BETA_PLAN_SHA256 ?? '')) throw Error('Approval and reviewed hash required');
  const uri = process.env.SAVORA_BETA_BOOTSTRAP_URI; checkUri(uri);
  const collections = checkManifest(JSON.parse(await readFile(new URL('../../../docs/public-beta-index-manifest.json',import.meta.url),'utf8')));
  const conn = mongoose.createConnection(uri,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:10000});
  try {
    await conn.asPromise();
    if (conn.name !== 'savora_beta' || conn.db.databaseName !== 'savora_beta') throw Error('Wrong database');
    const users = (await conn.db.admin().command({connectionStatus:1})).authInfo?.authenticatedUsers;
    if (!Array.isArray(users) || users.length !== 1 || users[0].user !== 'savora_beta_user' || !['admin','savora_beta'].includes(users[0].db)) throw Error('Wrong authenticated user');
    const operations = await plan(conn.db,collections);
    if (createHash('sha256').update(JSON.stringify(operations)).digest('hex') !== process.env.SAVORA_BETA_PLAN_SHA256) throw Error('Plan changed');
    for (const op of operations) {
      if (op.action === 'createCollection') await conn.db.createCollection(op.collection);
      else {
        if (await conn.db.collection(op.collection).findOne({}, {projection:{_id:1}})) throw Error('Records appeared');
        await conn.db.collection(op.collection).createIndex(op.key,op.options);
      }
    }
    console.log(JSON.stringify({database:'savora_beta',created:operations.length,status:'complete'}));
  } finally { await conn.close(); }
}
if (import.meta.main) main().catch(() => { console.error('Bootstrap stopped; review actual state with a new dry-run. No rollback was attempted.'); process.exitCode=1; });
