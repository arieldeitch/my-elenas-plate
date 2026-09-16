/**
 * Operation-level mutations (M1 Phase C).
 *
 * Every interactive edit in the store is expressed as a small, self-contained
 * operation that names exactly the row(s) it touches. Operations are:
 *  - narrow: an op never implies anything about rows it does not name, so a
 *    stale device can never delete an entry it has simply not seen yet;
 *  - idempotent on the server: upserts are keyed by a stable client-side id or
 *    by the table's natural unique key; deletes target one id / one natural key
 *    and are a no-op when the row is already gone;
 *  - device-portable: they carry LOCAL profile ids (`me` / `elena`) and ISO
 *    dates. DB ids are resolved at execution time (see `applyOperation`), so an
 *    op enqueued before the household context is known still applies later.
 *
 * `coalesceKey` lets the durable queue collapse several pending ops that would
 * end in the same final server state (e.g. two edits of one entry, or set-then-
 * clear of the same fasting record) into the latest one — keeping order among
 * unrelated ops intact.
 */
import type {
  FastingLog,
  Food,
  FoodEntry,
  MealSlotId,
  MealStatus,
  ProfileId,
  WeighIn,
  WorkoutLog,
} from "../domain";

export type Operation =
  | { kind: "entry.upsert"; profile: ProfileId; iso: string; slot: MealSlotId; entry: FoodEntry }
  | { kind: "entry.delete"; profile: ProfileId; iso: string; slot: MealSlotId; entryId: string }
  | { kind: "status.set"; profile: ProfileId; iso: string; slot: MealSlotId; status: MealStatus }
  | { kind: "fasting.set"; profile: ProfileId; iso: string; fasting: FastingLog }
  | { kind: "fasting.clear"; profile: ProfileId; iso: string }
  | { kind: "workout.set"; profile: ProfileId; iso: string; workout: WorkoutLog }
  | { kind: "workout.clear"; profile: ProfileId; iso: string }
  | { kind: "weighin.insert"; profile: ProfileId; weighIn: WeighIn }
  | { kind: "food.upsert"; food: Food }
  | { kind: "pref.favorite"; profile: ProfileId; foodId: string; isFavorite: boolean }
  | { kind: "pref.recent"; profile: ProfileId; foodId: string; at: string };

export type OperationKind = Operation["kind"];

/**
 * Ops sharing a coalesce key converge to the same final row, so only the most
 * recent one needs to reach the server. Keys are deliberately narrow (one row).
 */
export function coalesceKey(op: Operation): string {
  switch (op.kind) {
    case "entry.upsert":
      return `entry:${op.entry.id}`;
    case "entry.delete":
      return `entry:${op.entryId}`;
    case "status.set":
      return `status:${op.profile}:${op.iso}:${op.slot}`;
    case "fasting.set":
    case "fasting.clear":
      return `fasting:${op.profile}:${op.iso}`;
    case "workout.set":
    case "workout.clear":
      return `workout:${op.profile}:${op.iso}`;
    case "weighin.insert":
      return `weighin:${op.weighIn.id}`;
    case "food.upsert":
      return `food:${op.food.id}`;
    case "pref.favorite":
      return `pref.favorite:${op.profile}:${op.foodId}`;
    case "pref.recent":
      return `pref.recent:${op.profile}:${op.foodId}`;
  }
}

/** The (profile, date) day an op belongs to, or null for day-independent ops. */
export function dayKeyOf(op: Operation): string | null {
  switch (op.kind) {
    case "entry.upsert":
    case "entry.delete":
    case "status.set":
    case "fasting.set":
    case "fasting.clear":
    case "workout.set":
    case "workout.clear":
      return `${op.profile}::${op.iso}`;
    default:
      return null;
  }
}

export function dayKey(profile: ProfileId, iso: string): string {
  return `${profile}::${iso}`;
}

/** True when `op` mutates the given profile (any table). */
export function touchesProfile(op: Operation, profile: ProfileId): boolean {
  return "profile" in op && op.profile === profile;
}

export interface QueuedOperation {
  /** Stable client mutation id (uuid) — unique per enqueue, used for dedupe. */
  id: string;
  key: string;
  op: Operation;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  /** Permanent failure: skipped by flush until a person retries or discards it. */
  quarantined?: boolean;
  /**
   * Auth user id that was signed in when the op was created (when known). The
   * drain refuses to apply an op under a different user, so a queue left by
   * another account on this device can never be written into this household.
   */
  owner?: string;
}

// --- store → operations (pure derivations, unit-tested) ---------------------

export interface DayOpsContext {
  profile: ProfileId;
  iso: string;
}

export function opsForAddEntry(
  ctx: DayOpsContext,
  slot: MealSlotId,
  entry: FoodEntry,
): Operation[] {
  return [
    { kind: "entry.upsert", ...ctx, slot, entry },
    { kind: "status.set", ...ctx, slot, status: "logged" },
  ];
}

export function opsForUpdateEntry(
  ctx: DayOpsContext,
  slot: MealSlotId,
  entry: FoodEntry,
): Operation[] {
  return [{ kind: "entry.upsert", ...ctx, slot, entry }];
}

/**
 * Deleting one entry by id. The slot status only changes when the LOCAL view
 * of the meal became empty — and even then only that one status row.
 */
export function opsForRemoveEntry(
  ctx: DayOpsContext,
  slot: MealSlotId,
  entryId: string,
  remainingEntries: number,
  statusBefore: MealStatus,
): Operation[] {
  const ops: Operation[] = [{ kind: "entry.delete", ...ctx, slot, entryId }];
  if (remainingEntries === 0 && statusBefore === "logged") {
    ops.push({ kind: "status.set", ...ctx, slot, status: "empty" });
  }
  return ops;
}

/**
 * Skipping a meal clears the entries the device can SEE (by id) and marks the
 * slot skipped. Unskipping restores the derived status only.
 */
export function opsForSetMealSkipped(
  ctx: DayOpsContext,
  slot: MealSlotId,
  skipped: boolean,
  visibleEntryIds: string[],
): Operation[] {
  if (skipped) {
    return [
      ...visibleEntryIds.map<Operation>((entryId) => ({
        kind: "entry.delete",
        ...ctx,
        slot,
        entryId,
      })),
      { kind: "status.set", ...ctx, slot, status: "skipped" },
    ];
  }
  return [
    { kind: "status.set", ...ctx, slot, status: visibleEntryIds.length > 0 ? "logged" : "empty" },
  ];
}

export function opsForSetFasting(ctx: DayOpsContext, fasting: FastingLog | undefined): Operation[] {
  return fasting ? [{ kind: "fasting.set", ...ctx, fasting }] : [{ kind: "fasting.clear", ...ctx }];
}

export function opsForSetWorkout(ctx: DayOpsContext, workout: WorkoutLog | undefined): Operation[] {
  return workout ? [{ kind: "workout.set", ...ctx, workout }] : [{ kind: "workout.clear", ...ctx }];
}
