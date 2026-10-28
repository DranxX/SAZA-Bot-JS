// By DranxX Creative
/**
 * Per-contact command execution gate, tier-aware.
 * free tier: max N concurrent commands (default 1); overflow is queued
 * (bounded, with timeout) or rejected. premium/owner: always parallel, no queue.
 * Anti-spam is independent and stays applied to every tier.
 * Config via config.json "commandGate" (all fields optional, defaults below).
 */

const DEFAULTS = {
  enabled: true,
  maxConcurrentFree: 1,
  freeMode: 'queue',      // 'queue' | 'reject'
  maxQueue: 3,
  queueTimeoutMs: 30_000,
};

const lanes = new Map(); // contact → { running, queue: [{ resolve, timer }] }

function err(code, message) { const e = new Error(message); e.code = code; return e; }

function acquire(lane, cfg) {
  if (lane.running < cfg.maxConcurrentFree) { lane.running++; return Promise.resolve(); }
  if (cfg.freeMode === 'reject' || cfg.maxQueue <= 0) throw err('EBUSY', 'command gate busy');
  if (lane.queue.length >= cfg.maxQueue) throw err('EQUEUEFULL', 'command queue full');

  return new Promise((resolve, reject) => {
    const item = { resolve, timer: null };
    item.timer = setTimeout(() => {
      const i = lane.queue.indexOf(item);
      if (i !== -1) { lane.queue.splice(i, 1); reject(err('ETIMEDOUT', 'command queue timeout')); }
    }, cfg.queueTimeoutMs);
    lane.queue.push(item);
  });
}

// Note: a granted queue item keeps the lane's running count — release() hands the slot over.
function release(lane, contact) {
  const next = lane.queue.shift();
  if (next) { clearTimeout(next.timer); next.resolve(); return; }
  lane.running--;
  if (lane.running <= 0 && lane.queue.length === 0) lanes.delete(contact);
}

/**
 * Run fn under the contact's lane.
 * @param {string} contact unique sender key (resolved phone number)
 * @param {'free'|'premium'} tier
 * @param {() => Promise<any>} fn
 * @param {object} config live config object (reads config.commandGate)
 * @param {{ parallel?: boolean }} opts plugin opt-out via `parallel: true`
 */
export async function run(contact, tier, fn, config = {}, opts = {}) {
  const cfg = { ...DEFAULTS, ...((config && config.commandGate) || {}) };
  if (!cfg.enabled || tier !== 'free' || opts.parallel) return fn();

  let lane = lanes.get(contact);
  if (!lane) { lane = { running: 0, queue: [] }; lanes.set(contact, lane); }
  await acquire(lane, cfg);
  try {
    return await fn();
  } finally {
    release(lane, contact);
  }
}
