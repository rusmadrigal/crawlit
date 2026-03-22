/**
 * Cache for domain overview data with TTL.
 * Uses both in-memory (fast) and DB (persistent across serverless cold starts).
 * Key = domain (normalized) + locationCode so data is per country.
 */
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

type CacheEntry<T> = { data: T; expiresAt: number };

const memoryStore = new Map<string, CacheEntry<unknown>>();

function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase().trim();
}

function cacheKey(domain: string, locationCode: number): string {
  return `${normalizeDomain(domain)}:${locationCode}`;
}

/** Sync in-memory get (for backwards compat). Prefer getOverviewCachedAsync. */
export function getOverviewCached<T>(domain: string, locationCode: number = 2840): T | null {
  const key = cacheKey(domain, locationCode);
  const entry = memoryStore.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.data;
}

/** Async get: memory first, then DB. Use this when DataForSEO may be off. */
export async function getOverviewCachedAsync<T>(
  domain: string,
  locationCode: number = 2840
): Promise<T | null> {
  const key = cacheKey(domain, locationCode);
  const fromMemory = getOverviewCached<T>(domain, locationCode);
  if (fromMemory) return fromMemory;

  try {
    const { prisma } = await import("@/lib/db");
    const row = await prisma.overviewCache.findUnique({
      where: { domainKey: key },
    });
    if (!row || new Date(row.expiresAt) <= new Date()) {
      if (row) {
        await prisma.overviewCache.delete({ where: { domainKey: key } }).catch(() => {});
      }
      return null;
    }
    const data = JSON.parse(row.data) as T;
    // Repopulate memory for next request
    memoryStore.set(key, { data, expiresAt: new Date(row.expiresAt).getTime() });
    return data;
  } catch {
    return null;
  }
}

export function setOverviewCached<T>(
  domain: string,
  data: T,
  ttlMs: number = CACHE_TTL_MS,
  locationCode: number = 2840
): void {
  const key = cacheKey(domain, locationCode);
  const expiresAt = Date.now() + ttlMs;
  memoryStore.set(key, { data, expiresAt });
}

/** Async set: write to both memory and DB so it survives serverless restarts. */
export async function setOverviewCachedAsync<T>(
  domain: string,
  data: T,
  ttlMs: number = CACHE_TTL_MS,
  locationCode: number = 2840
): Promise<void> {
  const key = cacheKey(domain, locationCode);
  const expiresAt = new Date(Date.now() + ttlMs);
  setOverviewCached(domain, data, ttlMs, locationCode);

  try {
    const { prisma } = await import("@/lib/db");
    const payload = JSON.stringify(data);
    const normalized = normalizeDomain(domain);
    await prisma.overviewCache.upsert({
      where: { domainKey: key },
      create: { domainKey: key, domain: normalized, locationCode, data: payload, expiresAt },
      update: { data: payload, expiresAt },
    });
  } catch {
    // DB write failed; in-memory cache still works
  }
}

export function invalidateOverviewCache(domain: string, locationCode: number = 2840): void {
  memoryStore.delete(cacheKey(domain, locationCode));
}

/** Async invalidate: clear memory and DB. */
export async function invalidateOverviewCacheAsync(
  domain: string,
  locationCode: number = 2840
): Promise<void> {
  invalidateOverviewCache(domain, locationCode);
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.overviewCache.delete({ where: { domainKey: cacheKey(domain, locationCode) } }).catch(() => {});
  } catch {
    // ignore
  }
}
