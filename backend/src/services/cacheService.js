/**
 * Server-side high-performance in-memory TTL cache with stampede protection & instant invalidation
 * Designed for serverless and container deployments to eliminate redundant DB roundtrips.
 */

class ServerCache {
  constructor() {
    this.cache = new Map();
    this.inFlight = new Map();
    this.tagMap = new Map(); // tag -> Set of keys
  }

  set(key, value, ttlSeconds = 15, tag = null) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt, tag });

    if (tag) {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set());
      }
      this.tagMap.get(tag).add(key);
    }
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async getOrSet(key, fetchFn, ttlSeconds = 15, tag = null) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Stampede protection: share in-flight promise across concurrent requests
    if (this.inFlight.has(key)) {
      return await this.inFlight.get(key);
    }

    const promise = (async () => {
      try {
        const fresh = await fetchFn();
        if (fresh !== undefined && fresh !== null) {
          this.set(key, fresh, ttlSeconds, tag);
        }
        return fresh;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return await promise;
  }

  invalidate(key) {
    this.cache.delete(key);
    this.inFlight.delete(key);
  }

  invalidateTag(tag) {
    if (!this.tagMap.has(tag)) return;
    const keys = this.tagMap.get(tag);
    for (const key of keys) {
      this.cache.delete(key);
      this.inFlight.delete(key);
    }
    this.tagMap.delete(tag);
  }

  clear() {
    this.cache.clear();
    this.inFlight.clear();
    this.tagMap.clear();
  }
}

const serverCache = new ServerCache();

module.exports = serverCache;
