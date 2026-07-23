/**
 * Minimal reliable offline mutation queue. Backed by localStorage (IndexedDB
 * would add disproportionate complexity for this MVP). The queue is NOT the
 * source of truth — Supabase is; it only guarantees mutations survive reload
 * and reconnect, applied in order, deduplicated by client mutation id.
 */
export type MutationType = "insert" | "update" | "upsert" | "delete";

export interface QueuedMutation {
  /** Client mutation id — unique; used for dedupe + idempotency. */
  id: string;
  type: MutationType;
  entity: string;
  payload: unknown;
  householdId: string;
  profileId?: string;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  /** Set once a permanent failure is detected; skipped on future flushes. */
  quarantined?: boolean;
}

const QUEUE_KEY = "elenas-plate:queue:v1";

function read(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
  } catch {
    // Corrupt queue — start clean rather than crash the app.
    return [];
  }
}

function write(items: QueuedMutation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Failed to persist mutation queue", err);
  }
}

/** Adds a mutation, ignoring duplicates by id (idempotent enqueue). */
export function enqueue(m: QueuedMutation): void {
  const items = read();
  if (items.some((x) => x.id === m.id)) return;
  items.push(m);
  write(items);
}

/** Pending, non-quarantined mutations in insertion order. */
export function pending(): QueuedMutation[] {
  return read().filter((m) => !m.quarantined);
}

export function all(): QueuedMutation[] {
  return read();
}

export function remove(id: string): void {
  write(read().filter((m) => m.id !== id));
}

/** Records a retry; quarantines after `maxRetries` transient failures. */
export function markFailure(id: string, error: string, maxRetries = 5): void {
  const items = read();
  const m = items.find((x) => x.id === id);
  if (!m) return;
  m.retryCount += 1;
  m.lastError = error;
  if (m.retryCount >= maxRetries) m.quarantined = true;
  write(items);
}

/** Marks a mutation as permanently invalid (e.g. constraint violation). */
export function quarantine(id: string, error: string): void {
  const items = read();
  const m = items.find((x) => x.id === id);
  if (!m) return;
  m.quarantined = true;
  m.lastError = error;
  write(items);
}

export function clear(): void {
  write([]);
}

export function size(): number {
  return read().length;
}
