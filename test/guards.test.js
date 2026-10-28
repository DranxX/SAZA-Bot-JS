// By DranxX Creative
import { test, expect } from 'bun:test';
import { cached, invalidate, clearCache } from '../lib/singleflight.js';
import { check as spamCheck, sweep as spamSweep } from '../lib/antispam.js';
import { seen as dedupSeen, clear as clearDedup } from '../lib/msgdedup.js';
import { run as gatedRun } from '../lib/commandGate.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const deferred = () => { let resolve; const p = new Promise(r => (resolve = r)); return { p, resolve }; };

// ── singleflight ─────────────────────────────────────────────────────────────

test('singleflight dedupes concurrent calls per key', async () => {
  clearCache();
  let calls = 0;
  const fetcher = async () => { calls++; await sleep(20); return 'val'; };
  const [a, b] = await Promise.all([cached('k1', 1000, fetcher), cached('k1', 1000, fetcher)]);
  expect(a).toBe('val');
  expect(b).toBe('val');
  expect(calls).toBe(1);
});

test('singleflight caches per key with TTL', async () => {
  clearCache();
  let calls = 0;
  const f = async () => ++calls;
  await cached('k2', 50, f);
  await cached('k2', 50, f);
  expect(calls).toBe(1);
  await sleep(60);
  await cached('k2', 50, f);
  expect(calls).toBe(2);
});

test('singleflight serves stale value when refresh fails', async () => {
  clearCache();
  await cached('k3', 10, async () => 'good');
  await sleep(20); // let TTL expire
  const stale = await cached('k3', 10, async () => { throw new Error('down'); });
  expect(stale).toBe('good');
});

test('singleflight keys are independent', async () => {
  clearCache();
  await cached('a', 1000, async () => 'A');
  await cached('b', 1000, async () => 'B');
  invalidate('a');
  expect(await cached('a', 1000, async () => 'A2')).toBe('A2');
  expect(await cached('b', 1000, async () => 'B2')).toBe('B');
});

// ── antispam ─────────────────────────────────────────────────────────────────

const spamCfg = { antispam: { windowMs: 500, maxWarn: 2, maxBan: 4 } };

test('antispam allows up to maxWarn-1, warns at maxWarn, bans at maxBan', () => {
  const c = '628111';
  expect(spamCheck(c, {}, spamCfg).allowed).toBe(true);   // n=1 < maxWarn 2
  const r2 = spamCheck(c, {}, spamCfg);                   // n=2 == maxWarn
  expect(r2.allowed).toBe(false);
  expect(r2.warn).toBe(true);
  const r3 = spamCheck(c, {}, spamCfg);                   // n=3 → silent drop
  expect(r3.allowed).toBe(false);
  expect(r3.warn).toBe(false);
  const r4 = spamCheck(c, {}, spamCfg);                   // n=4 >= maxBan
  expect(r4.allowed).toBe(false);
  expect(r4.ban).toBe(true);
  expect(r4.banMs).toBe(60000);
});

test('antispam warns only once per window', () => {
  const c = '628199';
  const cfg = { antispam: { windowMs: 500, maxWarn: 1, maxBan: 5 } };
  expect(spamCheck(c, {}, cfg).warn).toBe(true);  // n=1 → warn
  expect(spamCheck(c, {}, cfg).warn).toBe(false); // n=2 → silent drop
  expect(spamCheck(c, {}, cfg).warn).toBe(false); // n=3 → silent drop
  expect(spamCheck(c, {}, cfg).warn).toBe(false); // n=4 → silent drop
  expect(spamCheck(c, {}, cfg).ban).toBe(true);   // n=5 → ban
});

test('antispam window slides — old commands expire', async () => {
  const c = '628222';
  const small = { antispam: { windowMs: 1000, maxWarn: 1, maxBan: 2 } };
  expect(spamCheck(c, {}, small).warn).toBe(true); // n=1 → warn
  await sleep(1100);
  const again = spamCheck(c, {}, small);           // window emptied → warn again as first command
  expect(again.count).toBe(1);
  expect(again.warn).toBe(true);
});

test('antispam exempt owner & premium', () => {
  for (let i = 0; i < 10; i++) expect(spamCheck('628333', { isOwner: true }, spamCfg).allowed).toBe(true);
  for (let i = 0; i < 10; i++) {
    expect(spamCheck('628344', { isPremium: true }, { antispam: { exemptPremium: true } }).allowed).toBe(true);
  }
});

test('antispam tracks contacts independently', () => {
  const a = '628555';
  spamCheck(a, {}, spamCfg);
  spamCheck(a, {}, spamCfg);
  expect(spamCheck('628666', {}, spamCfg).allowed).toBe(true);
});

test('antispam sweep drops idle contacts', async () => {
  const a = '628777';
  spamCheck(a, {}, spamCfg);
  spamCheck(a, {}, spamCfg);
  await sleep(10);
  spamSweep(0);
  expect(spamCheck(a, {}, spamCfg).allowed).toBe(true);
});

// ── commandGate ──────────────────────────────────────────────────────────────

const gateCfg = { commandGate: { maxConcurrentFree: 1, maxQueue: 2, queueTimeoutMs: 500 } };

test('gate: free tier runs commands sequentially per contact', async () => {
  const order = [];
  const d1 = deferred(), d2 = deferred();
  const p1 = gatedRun('u1', 'free', async () => { order.push('s1'); await d1.p; }, gateCfg);
  const p2 = gatedRun('u1', 'free', async () => { order.push('s2'); await d2.p; }, gateCfg);
  await sleep(30);
  expect(order).toEqual(['s1']); // second command waits in queue
  d1.resolve();
  await p1;
  await sleep(30);
  expect(order).toEqual(['s1', 's2']);
  d2.resolve();
  await p2;
});

test('gate: premium tier runs parallel without queue', async () => {
  const d1 = deferred(), d2 = deferred();
  let both = false;
  const p1 = gatedRun('u2', 'premium', () => d1.p, gateCfg);
  const p2 = gatedRun('u2', 'premium', async () => { both = true; await d2.p; }, gateCfg);
  await sleep(30);
  expect(both).toBe(true); // runs even though the first has not finished
  d1.resolve();
  d2.resolve();
  await Promise.all([p1, p2]);
});

test('gate: queue overflow rejects with EQUEUEFULL', async () => {
  const d = deferred();
  const p1 = gatedRun('u3', 'free', () => d.p, gateCfg);
  const p2 = gatedRun('u3', 'free', () => d.p, gateCfg);
  const p3 = gatedRun('u3', 'free', () => d.p, gateCfg);
  await expect(gatedRun('u3', 'free', () => d.p, gateCfg)).rejects.toMatchObject({ code: 'EQUEUEFULL' });
  d.resolve();
  await Promise.all([p1, p2, p3]);
});

test('gate: queued command times out with ETIMEDOUT', async () => {
  const d = deferred();
  const p1 = gatedRun('u4', 'free', () => d.p, gateCfg);
  await expect(
    gatedRun('u4', 'free', () => d.p, { commandGate: { maxConcurrentFree: 1, maxQueue: 2, queueTimeoutMs: 80 } })
  ).rejects.toMatchObject({ code: 'ETIMEDOUT' });
  d.resolve();
  await p1;
});

test('gate: opts.parallel bypasses queue for free tier', async () => {
  const d1 = deferred(), d2 = deferred();
  let both = false;
  const p1 = gatedRun('u5', 'free', () => d1.p, gateCfg);
  const p2 = gatedRun('u5', 'free', async () => { both = true; await d2.p; }, gateCfg, { parallel: true });
  await sleep(30);
  expect(both).toBe(true);
  d1.resolve();
  d2.resolve();
  await Promise.all([p1, p2]);
});

test('gate: different contacts run in parallel', async () => {
  const d = deferred();
  let bRan = false;
  const p1 = gatedRun('u6', 'free', () => d.p, gateCfg);
  const p2 = gatedRun('u7', 'free', async () => { bRan = true; }, gateCfg);
  await sleep(30);
  expect(bRan).toBe(true);
  d.resolve();
  await Promise.all([p1, p2]);
});

// ── antispam: message-timestamp window (redelivery regression) ───────────────

test('antispam counts five commands in one second, banning the fifth', () => {
  const cfg = { antispam: { windowMs: 1000, maxWarn: 4, maxBan: 5 } };
  const base = Date.now();
  for (let i = 0; i < 3; i++) {
    expect(spamCheck('ts1', {}, cfg, base + i * 100).allowed).toBe(true);
  }
  const warn = spamCheck('ts1', {}, cfg, base + 300);
  expect(warn.allowed).toBe(false);
  expect(warn.warn).toBe(true);
  const ban = spamCheck('ts1', {}, cfg, base + 400);
  expect(ban.allowed).toBe(false);
  expect(ban.ban).toBe(true);
});

test('antispam ignores hits outside the message-timestamp window', () => {
  const cfg = { antispam: { windowMs: 1000, maxWarn: 4, maxBan: 5 } };
  const base = Date.now();
  for (let i = 0; i < 4; i++) {
    spamCheck('ts2', {}, cfg, base - 60000 + i * 100);
  }
  const fresh = spamCheck('ts2', {}, cfg, base);
  expect(fresh.allowed).toBe(true);
  expect(fresh.count).toBe(1);
});

// ── msgdedup ─────────────────────────────────────────────────────────────────

test('msgdedup drops repeats within TTL, keys differ per chat/id', () => {
  clearDedup();
  expect(dedupSeen('c\x00id1')).toBe(false);
  expect(dedupSeen('c\x00id1')).toBe(true);
  expect(dedupSeen('c2\x00id1')).toBe(false);
  expect(dedupSeen('c\x00id2')).toBe(false);
  expect(dedupSeen('')).toBe(false);
});

test('msgdedup forgets keys after TTL', async () => {
  clearDedup();
  expect(dedupSeen('k', 30)).toBe(false);
  expect(dedupSeen('k', 30)).toBe(true);
  await sleep(40);
  expect(dedupSeen('k', 30)).toBe(false);
});

test('msgdedup stays bounded under a flood', () => {
  clearDedup();
  for (let i = 0; i < 10000; i++) dedupSeen('flood\x00' + i);
  expect(dedupSeen('flood\x00' + 9999)).toBe(true); // recent keys survive a partial sweep
  clearDedup();
});
