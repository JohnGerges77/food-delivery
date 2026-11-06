import { createReadStream } from 'node:fs';
import { mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';

const KEY = /^media\/[0-9a-f]{24}\/[0-9a-f]{24}\/(small|large)\.webp$/;

export function validMediaKey(key) { return typeof key === 'string' && KEY.test(key); }

export function storageConfig(env = process.env) {
  const provider = env.MEDIA_STORAGE_PROVIDER?.trim();
  if (!provider) return null;
  if (provider !== 'local') throw new Error('Invalid MEDIA_STORAGE_PROVIDER');
  const directory = env.UPLOADS_DIR?.trim();
  if (!directory || !path.isAbsolute(directory) || env.VERCEL === '1') {
    throw new Error('Local media requires a persistent absolute UPLOADS_DIR outside Vercel');
  }
  const resolved = path.resolve(directory);
  const repository = path.resolve(import.meta.dirname, '../../..');
  if (resolved === repository || resolved.startsWith(`${repository}${path.sep}`)) {
    throw new Error('UPLOADS_DIR must be outside the repository');
  }
  return { provider, directory: resolved };
}

export function createMediaStorage(config = storageConfig()) {
  if (!config) return null;
  if (config.provider !== 'local') throw new Error('Invalid media provider');
  return {
    provider: 'local',
    async write(key, bytes) {
      if (!validMediaKey(key)) throw new Error('Invalid media key');
      const destination = path.join(config.directory, ...key.split('/'));
      await mkdir(path.dirname(destination), { recursive: true });
      const file = await open(destination, 'wx', 0o600);
      try { await file.writeFile(bytes); }
      catch (error) { await file.close(); await rm(destination, { force: true }); throw error; }
      await file.close();
    },
    async read(key) {
      if (!validMediaKey(key)) throw new Error('Invalid media key');
      try {
        const file = await open(path.join(config.directory, ...key.split('/')), 'r');
        await file.close();
        return createReadStream(path.join(config.directory, ...key.split('/')));
      } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async delete(key) {
      if (!validMediaKey(key)) throw new Error('Invalid media key');
      await rm(path.join(config.directory, ...key.split('/')), { force: true });
    },
  };
}
