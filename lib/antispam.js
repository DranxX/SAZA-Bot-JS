// By DranxX Creative
/**
 * Per-contact anti-spam — sliding window over recent command timestamps.
 * Pure decision engine: it never mutates stores or replies by itself.
 * Levels: ≤ maxWarn allowed → warn (once per window) → tempban at maxBan.
 * Config via config.json "antispam" (all fields optional, defaults below).
 */

const DEFAULTS = {
  enabled: true,
  windowMs: 1_000,    // sliding window size (spec: 5 commands within 1 second)
  maxWarn: 4,         // command count in window that triggers warning
  maxBan: 5,          // command count in window that triggers tempban
  banMs: 60_000,      // temporary ban duration (1 minute)
  exemptOwner: true,
  exemptPremium: false,
};

const hits = new Map();     // contact → number[] (recent command timestamps)
const warnedAt = new Map(); // contact → timestamp of last warning (warn once per window)

export function resolveConfig(config) {
  const a = (config && typeof config === 'object' && config.antispam) || {};
  const cfg = { ...DEFAULTS, ...a };
  cfg.windowMs = Math.max(1000, parseInt(cfg.windowMs, 10) || DEFAULTS.windowMs);
  cfg.maxWarn = Math.max(1, parseInt(cfg.maxWarn, 10) || DEFAULTS.maxWarn);
  cfg.maxBan = Math.max(cfg.maxWarn + 1, parseInt(cfg.maxBan, 10) || cfg.maxWarn + 1);
  cfg.banMs = Number.isFinite(parseInt(cfg.banMs, 10)) ? Math.max(1000, parseInt(cfg.banMs, 10)) : DEFAULTS.banMs;
  return cfg;
}

/**
 * Record a command for a contact and decide whether it may run.
 * Window math runs on msgTsMs (message timestamp, ms) when provided — so
 * redelivered or stale messages can never inflate the current window —
 * falling back to Date.now() for live traffic.
 * @param {string} contact unique sender key (resolved phone number)
 * @param {{ isOwner?: boolean, isPremium?: boolean }} exempt
 * @param {object} config live config object (reads config.antispam)
 * @param {number} [msgTsMs] message timestamp in ms (baileys messageTimestamp * 1000)
 * @returns {{ allowed: boolean, warn?: boolean, ban?: boolean, count: number, windowMs: number, maxWarn: number }}
 */
export function check(contact, exempt = {}, config = {}, msgTsMs = 0) {
  const cfg = resolveConfig(config);
  const count = { count: 0, windowMs: cfg.windowMs, maxWarn: cfg.maxWarn };
  if (!cfg.enabled) return { allowed: true, ...count };
  if (cfg.exemptOwner && exempt.isOwner) return { allowed: true, ...count };
  if (cfg.exemptPremium && exempt.isPremium) return { allowed: true, ...count };

  const now = msgTsMs > 0 ? msgTsMs : Date.now();
  const cutoff = now - cfg.windowMs;
  const arr = (hits.get(contact) || []).filter(t => t > cutoff);
  arr.push(now);
  hits.set(contact, arr);

  const n = arr.length;
  count.count = n;
  if (n >= cfg.maxBan) return { allowed: false, ban: true, banMs: cfg.banMs, ...count };
  if (n >= cfg.maxWarn) {
    const warn = (warnedAt.get(contact) || 0) <= cutoff;
    if (warn) warnedAt.set(contact, now);
    return { allowed: false, warn, ...count };
  }
  return { allowed: true, ...count };
}

/** Drop tracking for contacts with no recent activity — call periodically. */
export function sweep(windowMs = DEFAULTS.windowMs) {
  const cutoff = Date.now() - windowMs * 2;
  for (const [k, arr] of hits) {
    if (!arr.length || arr[arr.length - 1] < cutoff) { hits.delete(k); warnedAt.delete(k); }
  }
}
