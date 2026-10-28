// By DranxX Creative
/**
 * Single-flight + TTL cache, keyed (e.g. per contact / per chat JID).
 * Concurrent calls for the same key share one in-flight fetch;
 * results are cached per key with TTL; stale value is served when a refresh fails.
 */

const flights = new Map(); // key → in-flight Promise
const cache = new Map();   // key → { value, expires }

// Warning: cache size is bounded by the number of distinct keys (chat count).
export async function cached(key, ttlMs, fetchFn) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value;

  const inflight = flights.get(key);
  if (inflight) return inflight;

  const flight = (async () => {
    try {
      const value = await fetchFn();
      cache.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } catch (err) {
      if (hit) return hit.value; // refresh failed — serve stale instead of throwing
      throw err;
    } finally {
      flights.delete(key);
    }
  })();
  flights.set(key, flight);
  return flight;
}

export function invalidate(key) { cache.delete(key); }

export function invalidatePrefix(prefix) {
  for (const k of [...cache.keys()]) if (String(k).startsWith(prefix)) cache.delete(k);
}

export function clearCache() { cache.clear(); }
