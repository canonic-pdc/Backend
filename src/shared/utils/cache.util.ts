interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * A lightweight, thread-safe in-memory cache with Time-To-Live (TTL) support.
 * Ideal for caching database lookups and API responses in serverless environments
 * without external service dependencies.
 */
export class MemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTtlMs: number;

  /**
   * @param defaultTtlSeconds Default time-to-live in seconds (default: 300s / 5 minutes)
   */
  constructor(defaultTtlSeconds: number = 300) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  /**
   * Store a value in the cache with an optional specific TTL in milliseconds.
   */
  public set(key: string, value: T, ttlMs?: number): void {
    const duration = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + duration,
    });
  }

  /**
   * Retrieve a value from the cache. Returns null if missing or expired.
   */
  public get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Delete a specific key from the cache.
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all cached keys that start with a given prefix.
   */
  public invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Get total active (non-expired) items count.
   */
  public size(): number {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }
}
