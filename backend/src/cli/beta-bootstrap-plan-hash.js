import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (report.mode !== 'dry-run' || report.database !== 'savora_beta' || report.authenticatedUser !== 'savora_beta_user' || !Array.isArray(report.operations)) throw Error('Invalid plan');
console.log(createHash('sha256').update(JSON.stringify(report.operations)).digest('hex'));
