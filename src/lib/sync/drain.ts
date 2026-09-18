/**
 * Queue drain loop (M1 Phase D): applies pending operations in order, exactly
 * once each, with bounded retry. Pure over its dependencies so the ordering and
 * failure semantics are unit-tested without Supabase.
 *
 * Failure classes:
 *  - `network`   — offline / fetch failure: stop the loop, keep the op pending,
 *                  do NOT consume its retry budget (being offline is not a fault
 *                  of the mutation).
 *  - `permanent` — the server rejected the op itself (constraint, RLS, bad
 *                  payload): quarantine immediately so it stays visible and the
 *                  rest of the queue is not blocked behind it.
 *  - `transient` — anything else (5xx, timeout, expired token): count one
 *                  attempt; after `maxRetries` the op is quarantined.
 */
import type { QueuedOperation } from "./operations";

export type FailureClass = "network" | "permanent" | "transient";

interface ErrorLike {
  name?: string;
  message?: string;
  code?: string;
  status?: number;
}

/** Classifies an error thrown by a Supabase call (pure, defensive). */
export function classifyError(err: unknown, online = true): FailureClass {
  if (!online) return "network";
  const e = (err ?? {}) as ErrorLike;
  const msg = (e.message ?? "").toLowerCase();
  const code = String(e.code ?? "");
  if (
    e.name === "TypeError" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("fetch failed")
  ) {
    return "network";
  }
  // PostgreSQL SQLSTATE classes: 22 = data exception, 23 = integrity
  // constraint, 42 = syntax/access (42501 = RLS insufficient privilege).
  if (/^(22|23|42)/.test(code)) return "permanent";
  // PostgREST: PGRST1xx = request shaping errors (bad payload / missing column).
  if (/^PGRST1\d\d$/.test(code)) return "permanent";
  if (
    e.status === 400 ||
    e.status === 403 ||
    e.status === 404 ||
    e.status === 409 ||
    e.status === 422
  )
    return "permanent";
  return "transient";
}

export function errorMessage(err: unknown): string {
  const e = (err ?? {}) as ErrorLike;
  const parts = [e.code, e.message].filter(Boolean);
  return parts.length ? parts.join(": ") : String(err);
}

export interface DrainDeps {
  pending: () => QueuedOperation[];
  apply: (m: QueuedOperation) => Promise<void>;
  remove: (id: string) => void;
  markFailure: (id: string, error: string, maxRetries?: number) => void;
  quarantine: (id: string, error: string) => void;
  isOnline?: () => boolean;
  maxRetries?: number;
}

export interface DrainResult {
  applied: number;
  quarantined: number;
  /** Set when the loop stopped early because the network is unavailable. */
  stoppedOffline: boolean;
  /** Set when a transient (counted) failure happened; caller should retry later. */
  transientFailures: number;
}

/**
 * Applies pending ops sequentially. Each op is removed from the queue only
 * after its server write resolved, so a crash mid-flight replays it (server
 * writes are idempotent). Stops at the first network failure to preserve order.
 */
export async function drainQueue(deps: DrainDeps): Promise<DrainResult> {
  const result: DrainResult = {
    applied: 0,
    quarantined: 0,
    stoppedOffline: false,
    transientFailures: 0,
  };
  const online = deps.isOnline ?? (() => true);
  if (!online()) {
    result.stoppedOffline = true;
    return result;
  }
  // Re-read on every step: an op may have been coalesced/replaced meanwhile.
  for (;;) {
    const next = deps.pending()[0];
    if (!next) break;
    try {
      await deps.apply(next);
      deps.remove(next.id);
      result.applied += 1;
    } catch (err) {
      const cls = classifyError(err, online());
      const msg = errorMessage(err);
      if (cls === "network") {
        result.stoppedOffline = true;
        break;
      }
      if (cls === "permanent") {
        deps.quarantine(next.id, msg);
        result.quarantined += 1;
        continue; // unrelated ops behind it can still proceed
      }
      deps.markFailure(next.id, msg, deps.maxRetries);
      result.transientFailures += 1;
      // The budget ran out and the op was quarantined: unrelated ops behind
      // it may proceed. Otherwise preserve order — stop and let the retry
      // timer come back to this op.
      if (deps.pending()[0]?.id === next.id) break;
      result.quarantined += 1;
    }
  }
  return result;
}
