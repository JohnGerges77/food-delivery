// The server checks the live Restaurant separately. Only public catalog DTOs
// use this short, process-local cache.
export function createPublicCatalogCache({ ttl = 30_000, maxEntries = 128, now = Date.now } = {}) {
  const entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

  return function read<T>(key: readonly string[], load: () => Promise<T>): Promise<T> {
    const id = JSON.stringify(key);
    const time = now();
    const existing = entries.get(id);
    if (existing && existing.expiresAt > time) return existing.value as Promise<T>;
    entries.delete(id);
    if (entries.size >= maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }
    const value = Promise.resolve().then(load).catch((error: unknown) => {
      if (entries.get(id)?.value === value) entries.delete(id);
      throw error;
    });
    entries.set(id, { expiresAt: time + ttl, value });
    return value;
  };
}
