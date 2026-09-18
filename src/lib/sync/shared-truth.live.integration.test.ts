/**
 * M1 §5 Tests 1–4 (+ DELETE realtime payload inspection) against a LIVE
 * isolated Supabase environment — real Auth, RLS and Realtime — through the
 * real operation executor (`applyOperation`) and real hydration (`loadDay`).
 * "Devices" are two authenticated clients of the same shared account.
 *
 * Skipped unless SUPABASE_TEST_URL + SUPABASE_TEST_ANON_KEY point at the
 * isolated hosted test branch (never production — this creates accounts).
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { FoodEntry } from "../domain";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const DOMAIN = process.env.SUPABASE_TEST_EMAIL_DOMAIN || "example.com";
const run = Boolean(URL && ANON);

// The executor reaches Supabase through `requireSupabase()`; point it at the
// currently active "device" client so each op runs under that device's session.
const devices = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../supabase/client", () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => devices.current,
  requireSupabase: () => devices.current,
  validateSupabaseEnv: () => ({ ok: true }),
}));

const { applyOperation, hydrateDay, subscribeHousehold } = await import("./supabase-sync");
const { opsForAddEntry, opsForRemoveEntry, opsForSetFasting, opsForSetWorkout } =
  await import("./operations");
type Ctx = import("../supabase/repositories").HouseholdContext;
type Change = import("./supabase-sync").RealtimeChange;

function client(): SupabaseClient<Database> {
  return createClient<Database>(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uuid = () => crypto.randomUUID();
const ISO = "2026-09-16";
const entry = (id: string, name: string): FoodEntry => ({
  id,
  foodId: "",
  foodName: name,
  mode: "measured",
  amount: 1,
  unit: "יחידה",
});

async function waitFor<T>(fn: () => T | undefined, timeoutMs = 25_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (Date.now() - start > timeoutMs) throw new Error("timeout waiting for realtime event");
    await sleep(250);
  }
}

describe.skipIf(!run)("M1 shared truth — live (real Auth/RLS/Realtime)", () => {
  let A: SupabaseClient<Database>;
  let B: SupabaseClient<Database>;
  let ctx: Ctx;
  let tokenB: string;
  const asDevice = (c: SupabaseClient<Database>) => {
    devices.current = c;
  };
  const on = async (c: SupabaseClient<Database>, ops: ReturnType<typeof opsForAddEntry>) => {
    asDevice(c);
    for (const op of ops) await applyOperation(ctx, op);
  };

  beforeAll(async () => {
    const email = `live_${Date.now()}_${Math.floor(Math.random() * 1e6)}@${DOMAIN}`;
    const password = "password123";
    A = client();
    const { data, error } = await A.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error("no session — disable email confirmation on the branch");
    const { data: hid, error: bErr } = await A.rpc("bootstrap_household");
    if (bErr) throw bErr;
    const { data: profiles } = await A.from("profiles").select("*").order("sort_order");
    ctx = {
      householdId: hid as string,
      profileIdBySlug: Object.fromEntries(profiles!.map((p) => [p.slug, p.id])),
    };
    B = client();
    const { data: sB, error: eB } = await B.auth.signInWithPassword({ email, password });
    if (eB) throw eB;
    tokenB = sB.session!.access_token;
  }, 60_000);

  const remoteNames = async (c: SupabaseClient<Database>, profile: "me" | "elena" = "me") => {
    asDevice(c);
    const day = await hydrateDay(ctx, profile, ISO);
    return day!.meals.lunch.entries.map((e) => e.foodName).sort();
  };

  it("Test 1 — stale add/add: both entries exist exactly once", async () => {
    const day = { profile: "me" as const, iso: ISO };
    const x = uuid();
    const y = uuid();
    await on(A, opsForAddEntry(day, "lunch", entry(x, "X")));
    // B never hydrated X and adds Y from its own stale state.
    await on(B, opsForAddEntry(day, "lunch", entry(y, "Y")));
    expect(await remoteNames(A)).toEqual(["X", "Y"]);
    expect(await remoteNames(B)).toEqual(["X", "Y"]);
    // Replay (offline → reconnect) never duplicates.
    await on(B, opsForAddEntry(day, "lunch", entry(y, "Y")));
    expect(await remoteNames(A)).toEqual(["X", "Y"]);
    // Test 2 — unrelated delete safety: A deletes X, Y remains.
    await on(A, opsForRemoveEntry(day, "lunch", x, 0, "logged"));
    expect(await remoteNames(A)).toEqual(["Y"]);
    expect(await remoteNames(B)).toEqual(["Y"]);
    // Deleting again (replay) is harmless.
    await on(A, opsForRemoveEntry(day, "lunch", x, 0, "logged"));
    expect(await remoteNames(B)).toEqual(["Y"]);
  }, 60_000);

  it("Test 3 — two profiles edited concurrently never cross-contaminate", async () => {
    const a1 = uuid();
    const e1 = uuid();
    await Promise.all([
      on(A, opsForAddEntry({ profile: "me", iso: ISO }, "lunch", entry(a1, "Ariel-1"))),
      on(B, opsForAddEntry({ profile: "elena", iso: ISO }, "lunch", entry(e1, "Elena-1"))),
    ]);
    await on(B, opsForSetFasting({ profile: "elena", iso: ISO }, { start: "20:00", end: "12:00" }));
    asDevice(A);
    const ariel = await hydrateDay(ctx, "me", ISO);
    const elena = await hydrateDay(ctx, "elena", ISO);
    expect(ariel!.meals.lunch.entries.map((e) => e.foodName)).toContain("Ariel-1");
    expect(ariel!.meals.lunch.entries.map((e) => e.foodName)).not.toContain("Elena-1");
    expect(elena!.meals.lunch.entries.map((e) => e.foodName)).toEqual(["Elena-1"]);
    expect(elena!.fasting).toEqual({ start: "20:00", end: "12:00" });
    expect(ariel!.fasting).toBeUndefined();
  }, 60_000);

  it("Test 4 + realtime payloads — fasting/workout set and clear reach the other device; DELETE carries only the id", async () => {
    const changes: Change[] = [];
    const raw: Array<{ table: string; eventType: string; oldKeys: string[]; newKeys: string[] }> =
      [];
    asDevice(B);
    const unsub = subscribeHousehold(ctx, (c) => changes.push(c), tokenB);
    // Raw channel on the same socket to inspect the DELETE payload shape.
    const rawChannel = B.channel(`raw:${ctx.householdId}`);
    for (const table of ["fasting_logs", "workout_logs", "food_entries"] as const) {
      rawChannel.on("postgres_changes", { event: "*", schema: "public", table }, (p) =>
        raw.push({
          table,
          eventType: p.eventType,
          oldKeys: Object.keys(p.old ?? {}),
          newKeys: Object.keys(p.new ?? {}),
        }),
      );
    }
    rawChannel.subscribe();
    await sleep(4000); // no replay before SUBSCRIBED

    const day = { profile: "me" as const, iso: "2026-09-17" };
    try {
      await on(A, opsForSetFasting(day, { start: "21:00", end: "13:00" }));
      const ins = await waitFor(() =>
        changes.find((c) => c.table === "fasting_logs" && c.eventType === "INSERT"),
      );
      expect(ins.profile).toBe("me");
      expect(ins.iso).toBe(day.iso);

      await on(A, opsForSetFasting(day, undefined));
      const del = await waitFor(() =>
        changes.find((c) => c.table === "fasting_logs" && c.eventType === "DELETE"),
      );
      // Under REPLICA IDENTITY DEFAULT the DELETE payload only has the PK.
      const rawDel = raw.find((r) => r.table === "fasting_logs" && r.eventType === "DELETE");
      expect(rawDel?.oldKeys).toEqual(["id"]);
      expect(del.rowId).toBeTruthy();
      expect(del.profile).toBeUndefined();
      expect(del.iso).toBeUndefined();
      asDevice(B);
      expect((await hydrateDay(ctx, "me", day.iso))!.fasting).toBeUndefined();

      await on(A, opsForSetWorkout(day, { performed: true, type: "ריצה" }));
      await waitFor(() =>
        changes.find((c) => c.table === "workout_logs" && c.eventType === "INSERT"),
      );
      await on(A, opsForSetWorkout(day, undefined));
      await waitFor(() =>
        changes.find((c) => c.table === "workout_logs" && c.eventType === "DELETE"),
      );
      asDevice(B);
      expect((await hydrateDay(ctx, "me", day.iso))!.workout).toBeUndefined();

      // Food entry insert + delete: the same shape (DELETE → id only).
      const id = uuid();
      await on(A, opsForAddEntry(day, "dinner", entry(id, "Z")));
      const fi = await waitFor(() =>
        changes.find((c) => c.table === "food_entries" && c.eventType === "INSERT"),
      );
      expect(fi.rowId).toBe(id);
      expect(fi.profile).toBe("me");
      await on(A, opsForRemoveEntry(day, "dinner", id, 0, "logged"));
      const fd = await waitFor(() =>
        changes.find((c) => c.table === "food_entries" && c.eventType === "DELETE"),
      );
      expect(fd.rowId).toBe(id);
    } finally {
      unsub();
      await B.removeChannel(rawChannel);
    }
  }, 120_000);
});
