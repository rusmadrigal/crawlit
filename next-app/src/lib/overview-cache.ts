/**
 * In-memory cache for domain overview data with TTL.
 * Key = domain (normalized) + locationCode so data is per country.
 * Only used on the server (API routes).
 * Longer TTL reduces DataForSEO API usage (fewer repeated calls).
 * Note: On serverless (Vercel), each instance has its own memory; cache does not persist across instances.
 */
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

type CacheEntry<T> = { data: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase().trim();
}

function cacheKey(domain: string, locationCode: number): string {
  return `${normalizeDomain(domain)}:${locationCode}`;
}

export function getOverviewCached<T>(domain: string, locationCode: number = 2840): T | null {
  const key = cacheKey(domain, locationCode);
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setOverviewCached<T>(
  domain: string,
  data: T,
  ttlMs: number = CACHE_TTL_MS,
  locationCode: number = 2840
): void {
  const key = cacheKey(domain, locationCode);
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateOverviewCache(domain: string, locationCode: number = 2840): void {
  store.delete(cacheKey(domain, locationCode));
}
