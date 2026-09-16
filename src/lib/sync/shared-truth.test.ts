/**
 * M1 regression suite — hermetic variants of the mandatory concurrency tests
 * (spec §5, tests 1–4 + idempotent replay), run against the in-memory Supabase
 * stand-in. They exercise the REAL mappers, repositories and operation executor;
 * only the transport is faked. The same scenarios must also pass against the
 * hosted Supabase test branch (real Auth/RLS/Realtime) before M1 is declared
 * complete — that gate is tracked separately.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FakeSupabase } from "../../test/fake-supabase";
import type { DayData, FoodEntry } from "../domain";
import { MEAL_SLOTS } from "../domain";
import type { HouseholdContext } from "../supabase/repositories";

const fake = new FakeSupabase();
vi.mock("../supabase/client", () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => fake,
  requireSupabase: () => fake,
  validateSupabaseEnv: () => ({ ok: true }),
}));

const { applyOperation, describeChange, hydrateDay, pushDaySnapshotUNSAFE } =
  await import("./supabase-sync");
const { opsForAddEntry, opsForRemoveEntry, opsForSetFasting, opsForSetWorkout } =
  await import("./operations");

const HOUSEHOLD = "11111111-1111-4111-8111-111111111111";
const ARIEL = "22222222-2222-4222-8222-222222222222";
const ALENA = "33333333-3333-4333-8333-333333333333";
const ctx: HouseholdContext = {
  householdId: HOUSEHOLD,
  profileIdBySlug: { ariel: ARIEL, alena: ALENA },
};
const ISO = "2026-09-16";

const entry = (id: string, name: string): FoodEntry => ({
  id,
  foodId: "",
  foodName: name,
  mode: "measured",
  amount: 1,
  unit: "יחידה",
});

function emptyDay(): DayData {
  const meals = {} as DayData["meals"];
  for (const s of MEAL_SLOTS) meals[s] = { slot: s, status: "empty", entries: [] };
  return { meals };
}

const remoteEntries = (profileId = ARIEL) =>
  fake
    .rows("food_entries")
    .filter((r) => r.profile_id === profileId && r.log_date === ISO)
    .map((r) => r.food_name as string)
    .sort();

/** Runs a store-shaped edit for one "device": apply each derived op in order. */
async function run(ops: Awaited<ReturnType<typeof opsForAddEntry>>) {
  for (const op of ops) await applyOperation(ctx, op);
}

beforeEach(() => {
  fake.tables.clear();
  fake.log.length = 0;
});

describe("Test 1 — stale-device same-day add/add", () => {
  it("both entries exist exactly once with operation-level writes", async () => {
    const day = { profile: "me" as const, iso: ISO };
    // Device A adds X.
    await run(opsForAddEntry(day, "lunch", entry("x-x", "X")));
    // Device B never hydrated X (stale) and adds Y from its own state.
    await run(opsForAddEntry(day, "lunch", entry("y-y", "Y")));
    expect(remoteEntries()).toEqual(["X", "Y"]);
    // And hydrating either device yields both.
    const hydrated = await hydrateDay(ctx, "me", ISO);
    expect(hydrated!.meals.lunch.entries.map((e) => e.foodName).sort()).toEqual(["X", "Y"]);
    expect(hydrated!.meals.lunch.status).toBe("logged");
  });

  it("documents why the snapshot path is retired: B's stale snapshot deletes A's X", async () => {
    const day = { profile: "me" as const, iso: ISO };
    await run(opsForAddEntry(day, "lunch", entry("x-x", "X")));
    // B's whole-day snapshot only knows about Y.
    const staleB = emptyDay();
    staleB.meals.lunch = { slot: "lunch", status: "logged", entries: [entry("y-y", "Y")] };
    await pushDaySnapshotUNSAFE(ctx, "me", ISO, staleB);
    expect(remoteEntries()).toEqual(["Y"]); // X is gone — the M1 root cause, confirmed
  });

  it("operation writes never issue a delete the device did not ask for", async () => {
    const day = { profile: "me" as const, iso: ISO };
    await run(opsForAddEntry(day, "lunch", entry("x-x", "X")));
    await run(opsForAddEntry(day, "lunch", entry("y-y", "Y")));
    expect(fake.log.filter((l) => l.action === "delete")).toHaveLength(0);
    // ...and never read the whole day to decide what to write.
    expect(fake.log.filter((l) => l.action === "select")).toHaveLength(0);
  });
});

describe("Test 2 — unrelated delete safety", () => {
  it("A deleting X leaves B's Y intact", async () => {
    const day = { profile: "me" as const, iso: ISO };
    await run(opsForAddEntry(day, "lunch", entry("x-x", "X")));
    await run(opsForAddEntry(day, "lunch", entry("y-y", "Y")));
    // A's local view: it still sees only X (stale), removes it → meal empty locally.
    await run(opsForRemoveEntry(day, "lunch", "x-x", 0, "logged"));
    expect(remoteEntries()).toEqual(["Y"]);
    const deletes = fake.log.filter((l) => l.action === "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].filters).toEqual([{ col: "id", op: "eq", val: "x-x" }]);
  });

  it("deleting an entry that is already gone is a harmless no-op", async () => {
    const day = { profile: "me" as const, iso: ISO };
    await run(opsForAddEntry(day, "lunch", entry("y-y", "Y")));
    await expect(
      run(opsForRemoveEntry(day, "lunch", "never-existed", 1, "logged")),
    ).resolves.toBeUndefined();
    expect(remoteEntries()).toEqual(["Y"]);
  });
});

describe("Test 3 — two-profile isolation under concurrent use", () => {
  it("edits to Ariel and Elena on the same date never cross", async () => {
    await run(opsForAddEntry({ profile: "me", iso: ISO }, "dinner", entry("a1", "Ariel-1")));
    await run(opsForAddEntry({ profile: "elena", iso: ISO }, "dinner", entry("e1", "Elena-1")));
    await run(opsForSetFasting({ profile: "elena", iso: ISO }, { start: "20:00", end: "12:00" }));
    await run(opsForRemoveEntry({ profile: "me", iso: ISO }, "dinner", "a1", 0, "logged"));

    expect(remoteEntries(ARIEL)).toEqual([]);
    expect(remoteEntries(ALENA)).toEqual(["Elena-1"]);
    const ariel = await hydrateDay(ctx, "me", ISO);
    const elena = await hydrateDay(ctx, "elena", ISO);
    expect(ariel!.fasting).toBeUndefined();
    expect(elena!.fasting).toEqual({ start: "20:00", end: "12:00" });
    expect(elena!.meals.dinner.status).toBe("logged");
    expect(ariel!.meals.dinner.status).toBe("empty");
  });
});

describe("Test 4 — fasting / workout create and clear", () => {
  it("clearing fasting removes the remote row (previously there was no delete path)", async () => {
    const day = { profile: "me" as const, iso: ISO };
    await run(opsForSetFasting(day, { start: "21:00", end: "13:00" }));
    expect((await hydrateDay(ctx, "me", ISO))!.fasting).toEqual({ start: "21:00", end: "13:00" });
    await run(opsForSetFasting(day, undefined));
    expect(fake.rows("fasting_logs")).toHaveLength(0);
    expect((await hydrateDay(ctx, "me", ISO))!.fasting).toBeUndefined();
    // Clearing again (e.g. replay) does not fail.
    await expect(run(opsForSetFasting(day, undefined))).resolves.toBeUndefined();
  });

  it("clearing a workout removes the remote row; set is an upsert on (profile, date)", async () => {
    const day = { profile: "me" as const, iso: ISO };
    await run(opsForSetWorkout(day, { performed: true, type: "ריצה", feeling: "טוב" }));
    await run(opsForSetWorkout(day, { performed: true, type: "הליכה" }));
    expect(fake.rows("workout_logs")).toHaveLength(1);
    expect((await hydrateDay(ctx, "me", ISO))!.workout).toEqual({
      performed: true,
      type: "הליכה",
      feeling: undefined,
    });
    await run(opsForSetWorkout(day, undefined));
    expect(fake.rows("workout_logs")).toHaveLength(0);
    expect((await hydrateDay(ctx, "me", ISO))!.workout).toBeUndefined();
  });
});

describe("idempotent replay (offline → reconnect → replay)", () => {
  it("re-applying the same entry op yields one row", async () => {
    const day = { profile: "me" as const, iso: ISO };
    const ops = opsForAddEntry(day, "lunch", entry("x-x", "X"));
    await run(ops);
    await run(ops);
    expect(remoteEntries()).toEqual(["X"]);
    expect(fake.rows("meal_statuses")).toHaveLength(1);
  });

  it("re-applying a weigh-in op with a stable client id yields one row", async () => {
    const op = {
      kind: "weighin.insert" as const,
      profile: "me" as const,
      weighIn: { id: "w-1", dateISO: ISO, weightKg: 80.5 },
    };
    await applyOperation(ctx, op);
    await applyOperation(ctx, op);
    expect(fake.rows("weigh_ins")).toHaveLength(1);
    expect(fake.rows("weigh_ins")[0].weight_kg).toBe(80.5);
  });

  it("built-in catalog foods are never written to the cloud", async () => {
    await applyOperation(ctx, {
      kind: "food.upsert",
      food: { id: "f_apple", name: "תפוח" },
    });
    expect(fake.rows("foods")).toHaveLength(0);
  });

  it("an op for an unknown profile fails loudly instead of writing to the wrong profile", async () => {
    await expect(
      applyOperation(
        { householdId: HOUSEHOLD, profileIdBySlug: { ariel: ARIEL } },
        { kind: "fasting.clear", profile: "elena", iso: ISO },
      ),
    ).rejects.toThrow(/elena/);
  });
});

describe("realtime payload → affected profile/date", () => {
  it("maps INSERT/UPDATE rows to the local profile + date", () => {
    const c = describeChange(ctx, "fasting_logs", {
      eventType: "INSERT",
      new: { id: "r1", profile_id: ALENA, log_date: ISO },
      old: {},
    });
    expect(c).toEqual({
      table: "fasting_logs",
      eventType: "INSERT",
      profile: "elena",
      iso: ISO,
      rowId: "r1",
    });
  });

  it("a DELETE with only the primary key yields no profile/date (caller must fall back)", () => {
    const c = describeChange(ctx, "food_entries", {
      eventType: "DELETE",
      new: {},
      old: { id: "gone" },
    });
    expect(c.profile).toBeUndefined();
    expect(c.iso).toBeUndefined();
    expect(c.rowId).toBe("gone");
  });
});
