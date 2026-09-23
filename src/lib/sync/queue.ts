/**
 * Durable operation queue (M1 Phase D). Backed by localStorage (IndexedDB would
 * add disproportionate complexity for this MVP).
 *
 * The queue is NOT the source of truth — Supabase is. Its only job is to make
 * sure an interactive edit that could not be sent yet (offline, transient
 * error, page closed mid-flight) survives reload and is applied exactly once,
 * in order, once the network is back. Entries are whole operations (see
 * `operations.ts`), never day snapshots.
 *
 * Guarantees:
 *  - `enqueue` is idempotent by mutation id and coalesces by row key: a newer
 *    op for the same row replaces the older pending op in place (so the queue
 *    never grows with redundant edits and never sends a stale intermediate);
 *  - `pending()` returns non-quarantined ops in insertion order;
 *  - transient failures are counted and bounded (`markFailure`), permanent
 *    ones are quarantined immediately (`quarantine`) and stay visible until a
 *    person retries or discards them — they never silently disappear.
 */
import { coalesceKey, dayKeyOf, type Operation, type QueuedOperation } from "./operations";

export type { QueuedOperation };

export const QUEUE_KEY = "elenas-plate:queue:v2";

function read(): QueuedOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedOperation[]) : [];
  } catch {
    // Corrupt queue — start clean rather than crash the app.
    return [];
  }
}

function write(items: QueuedOperation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Failed to persist mutation queue", err);
  }
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

let currentOwner: string | undefined;

/** Records the signed-in auth user id so new ops are stamped with it. */
export function setQueueOwner(userId: string | undefined): void {
  currentOwner = userId;
}

export function getQueueOwner(): string | undefined {
  return currentOwner;
}

/** Wraps an operation in a queue record with a fresh stable mutation id. */
export function toQueued(op: Operation, now = new Date()): QueuedOperation {
  const q: QueuedOperation = {
    id: newId(),
    key: coalesceKey(op),
    op,
    createdAt: now.toISOString(),
    retryCount: 0,
  };
  if (currentOwner) q.owner = currentOwner;
  return q;
}

/** True when the op may be applied under the given signed-in user. */
export function ownedBy(m: QueuedOperation, userId: string | undefined): boolean {
  return !m.owner || !userId || m.owner === userId;
}

/**
 * Re-stamps every stored op with the current device session (DEC-031). Every
 * session on a device belongs to the one shared household, so an op left
 * behind by a previous session identity (storage partly cleared, token
 * revoked) is still valid and must reach the cloud rather than sit unowned.
 * Returns the number of ops whose owner changed.
 */
export function adoptAll(userId: string): number {
  const items = read();
  let n = 0;
  for (const m of items) {
    if (m.owner !== userId) {
      m.owner = userId;
      n += 1;
    }
  }
  if (n > 0) write(items);
  return n;
}

/**
 * Adds a mutation. Duplicate ids are ignored. A pending (non-quarantined) op
 * with the same coalesce key is replaced IN PLACE by the newer one, which keeps
 * the original ordering slot while guaranteeing the latest value wins.
 */
export function enqueue(m: QueuedOperation): QueuedOperation {
  const items = read();
  if (items.some((x) => x.id === m.id)) return m;
  const idx = items.findIndex((x) => x.key === m.key && !x.quarantined);
  if (idx >= 0) items[idx] = { ...m, retryCount: 0 };
  else items.push(m);
  write(items);
  return m;
}

/** Convenience: build + enqueue an operation. */
export function enqueueOperation(op: Operation): QueuedOperation {
  return enqueue(toQueued(op));
}

/** Pending, non-quarantined mutations in insertion order. */
export function pending(): QueuedOperation[] {
  return read().filter((m) => !m.quarantined);
}

/** Quarantined (permanently failed) mutations awaiting a person's decision. */
export function quarantined(): QueuedOperation[] {
  return read().filter((m) => m.quarantined);
}

export function all(): QueuedOperation[] {
  return read();
}

export function remove(id: string): void {
  write(read().filter((m) => m.id !== id));
}

/** Records a transient failure; quarantines after `maxRetries` attempts. */
export function markFailure(id: string, error: string, maxRetries = 5): void {
  const items = read();
  const m = items.find((x) => x.id === id);
  if (!m) return;
  m.retryCount += 1;
  m.lastError = error;
  if (m.retryCount >= maxRetries) m.quarantined = true;
  write(items);
}

/** Marks a mutation as permanently invalid (e.g. constraint / RLS violation). */
export function quarantine(id: string, error: string): void {
  const items = read();
  const m = items.find((x) => x.id === id);
  if (!m) return;
  m.quarantined = true;
  m.lastError = error;
  write(items);
}

/** A person asked to retry: quarantined ops become pending again with a fresh budget. */
export function retryQuarantined(): number {
  const items = read();
  let n = 0;
  for (const m of items) {
    if (m.quarantined) {
      m.quarantined = false;
      m.retryCount = 0;
      n += 1;
    }
  }
  write(items);
  return n;
}

/** A person gave up on the failed ops: drop them (local optimistic state stays). */
export function discardQuarantined(): number {
  const items = read();
  const keep = items.filter((m) => !m.quarantined);
  write(keep);
  return items.length - keep.length;
}

export function clear(): void {
  write([]);
}

export function size(): number {
  return read().length;
}

/** Days (`profile::iso`) that still have unsent ops — hydrate must not clobber them. */
export function pendingDayKeys(): Set<string> {
  const keys = new Set<string>();
  for (const m of pending()) {
    const k = dayKeyOf(m.op);
    if (k) keys.add(k);
  }
  return keys;
}

/**
 * True when the queue still holds an unsent op of any of these kinds. Used by
 * the household-wide hydrates (dishes / estimated products / bridges), which
 * are not profile-scoped: the server list simply would not contain a row that
 * has not been sent yet, so replacing local state with it would lose it.
 */
export function hasPendingKinds(kinds: Set<string>): boolean {
  return pending().some((m) => kinds.has(m.op.kind));
}

/** True when any unsent op targets this local profile (weigh-ins, prefs, days). */
export function hasPendingForProfile(profile: string, kinds?: Set<string>): boolean {
  return pending().some(
    (m) => "profile" in m.op && m.op.profile === profile && (!kinds || kinds.has(m.op.kind)),
  );
}
