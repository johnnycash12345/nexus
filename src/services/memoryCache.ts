

interface CacheEntry {
  data: any;
  expires: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

class MemoryCache {
  private cache = new Map<string, CacheEntry>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.data as T;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    const expires = Date.now() + ttlMs;
    this.cache.set(key, { data, expires });
  }

  has(key: string): boolean {
    return this.cache.has(key) && (this.cache.get(key)?.expires ?? 0) > Date.now();
  }

  clear(): void {
    this.cache.clear();
  }
}

export const memoryCache = new MemoryCache();