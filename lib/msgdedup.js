// By DranxX Creative
/**
 * In-memory message-ID dedup — reconnect redeliveries are processed once.
 * Bounded: past 8192 live keys the map is dropped wholesale (fail-open).
 * Note: a restart forgets recent IDs; the stale-message filter covers that gap.
 */

const TTL_MS_DEFAULT = 120_000;
const SWEEP_AT = 4096;
const HARD_CAP = 8192;

const seenMap = new Map(); // key → seen-at ms

/**
 * Record key and report whether it was already seen inside the TTL.
 * @param {string} key chat+message id
 * @param {number} [ttlMs]
 * @returns {boolean} true when the key is a duplicate
 */
export function seen(key, ttlMs = TTL_MS_DEFAULT) {
  if (!key) return false;
  const now = Date.now();
  if (seenMap.has(key) && now - seenMap.get(key) <= ttlMs) return true;
  seenMap.set(key, now);
  if (seenMap.size > HARD_CAP) {
    seenMap.clear();
    return false;
  }
  if (seenMap.size > SWEEP_AT) {
    for (const [k, ts] of seenMap) {
      if (now - ts > ttlMs) seenMap.delete(k);
    }
  }
  return false;
}

/** Drop all tracked keys (test helper). */
export function clear() {
  seenMap.clear();
}
