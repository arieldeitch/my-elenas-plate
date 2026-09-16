/**
 * Hermetic test of the ACTIVE cloud path: the real StoreProvider + the real
 * useSupabaseSync hook + the real repositories, with only auth and transport
 * faked. Covers M1 acceptance criteria that live in the hook rather than in
 * the executor:
 *  - "saved" is shown only once the durable queue is empty (criterion 7);
 *  - an offline mutation survives a reload and syncs exactly once (Test 5);
 *  - a realtime event never overwrites an unsent local mutation (Phase E.3);
 *  - realtime covers fasting/workout and targets the affected profile/date;
 *  - reload reproduces the authoritative database state (criterion 6).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { FakeSupabase } from "../../test/fake-supabase";
import { toISODate } from "../format";
import { DEVICE_PROFILE_KEY } from "../device-profile";

const fake = new FakeSupabase();
const HOUSEHOLD = "11111111-1111-4111-8111-111111111111";
const ARIEL = "22222222-2222-4222-8222-222222222222";
const ALENA = "33333333-3333-4333-8333-333333333333";
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

vi.mock("../supabase/client", () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => fake,
  requireSupabase: () => fake,
  validateSupabaseEnv: () => ({ ok: true }),
}));
vi.mock("../supabase/auth", () => ({
  getSession: async () => ({ user: { id: USER }, access_token: "token" }),
  onAuthChange: () => () => {},
}));

const { StoreProvider, useStore } = await import("../store");
const queue = await import("./queue");

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);
const today = () => toISODate(new Date());
const apple = {
  foodId: "f_apple",
  foodName: "תפוח",
  mode: "measured" as const,
  amount: 1,
  unit: "יחידה" as const,
};

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value });
}

function seedHousehold() {
  fake.tables.clear();
  fake.rows("households").push({ id: HOUSEHOLD });
  fake
    .rows("profiles")
    .push(
      { id: ARIEL, household_id: HOUSEHOLD, slug: "ariel", sort_order: 1 },
      { id: ALENA, household_id: HOUSEHOLD, slug: "alena", sort_order: 2 },
    );
}

async function mountActive() {
  const hook = renderHook(() => useStore(), { wrapper });
  // Activation: bootstrap → hydrate → "saved" (queue empty).
  await waitFor(() => expect(hook.result.current.syncState).toBe("saved"));
  await waitFor(() => expect(fake.handlers.size).toBeGreaterThan(0));
  return hook;
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
  seedHousehold();
  fake.log.length = 0;
  fake.offline = false;
  setOnline(true);
});
afterEach(() => {
  setOnline(true);
  fake.offline = false;
});

describe("active cloud path (hermetic)", () => {
  it("drains an edit to Supabase and only then reports saved; reload reproduces DB state", async () => {
    const hook = await mountActive();
    act(() => hook.result.current.addEntry("dinner", apple));
    // Optimistic locally, durable in the queue, not yet "saved".
    expect(hook.result.current.getDay("me", today()).meals.dinner.entries).toHaveLength(1);
    expect(queue.pending().length).toBeGreaterThan(0);
    expect(hook.result.current.syncState).not.toBe("saved");

    await waitFor(() => expect(hook.result.current.syncState).toBe("saved"));
    expect(queue.pending()).toHaveLength(0);
    const rows = fake.rows("food_entries");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ profile_id: ARIEL, log_date: today(), food_name: "תפוח" });
    // Narrow writes only: no whole-day read/delete happened.
    expect(fake.log.filter((l) => l.action === "delete")).toHaveLength(0);
    hook.unmount();

    // "Reload": a fresh provider hydrates from the fake, exactly once.
    const again = await mountActive();
    await waitFor(() =>
      expect(again.result.current.getDay("me", today()).meals.dinner.entries).toHaveLength(1),
    );
    again.unmount();
  });

  it("Test 5 — an offline mutation survives a reload and syncs exactly once after reconnect", async () => {
    const hook = await mountActive();
    setOnline(false);
    fake.offline = true;
    act(() => hook.result.current.addEntry("lunch", apple));
    await waitFor(() => expect(hook.result.current.syncState).toBe("offline"));
    expect(hook.result.current.syncDetail.pending).toBeGreaterThan(0);
    expect(fake.rows("food_entries")).toHaveLength(0);
    // The op is on disk, not just in memory.
    expect(JSON.parse(window.localStorage.getItem(queue.QUEUE_KEY)!)).toHaveLength(3);
    hook.unmount(); // crash / close while still offline

    // Restore the app while still offline: still pending, nothing sent.
    const restored = await mountActiveOffline();
    expect(fake.rows("food_entries")).toHaveLength(0);
    expect(restored.result.current.syncState).not.toBe("saved");

    // Reconnect.
    setOnline(true);
    fake.offline = false;
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(restored.result.current.syncState).toBe("saved"), {
      timeout: 5000,
    });
    expect(fake.rows("food_entries")).toHaveLength(1);
    expect(queue.all()).toHaveLength(0);
    restored.unmount();

    // Fresh reload shows it exactly once, from the source of truth.
    const fresh = await mountActive();
    await waitFor(() =>
      expect(fresh.result.current.getDay("me", today()).meals.lunch.entries).toHaveLength(1),
    );
    expect(fake.rows("food_entries")).toHaveLength(1);
    fresh.unmount();
  });

  it("a realtime event never overwrites an unsent local mutation", async () => {
    const hook = await mountActive();
    setOnline(false);
    fake.offline = true;
    act(() => hook.result.current.setFasting({ start: "20:00", end: "12:00" }));
    await waitFor(() => expect(hook.result.current.syncState).toBe("offline"));

    // The partner's device writes something to the SAME day and realtime tells us.
    fake.rows("food_entries").push({
      id: "partner-1",
      household_id: HOUSEHOLD,
      profile_id: ARIEL,
      log_date: today(),
      slot: "dinner",
      food_name: "מלפפון",
      quantity_mode: "subjective",
      subjective: "little",
    });
    fake.offline = false; // the read itself would succeed…
    act(() =>
      fake.emit("food_entries", "INSERT", {
        id: "partner-1",
        profile_id: ARIEL,
        log_date: today(),
      }),
    );
    await new Promise((r) => setTimeout(r, 50));
    // …but the day is guarded: our unsent fasting record is still here.
    expect(hook.result.current.getDay("me", today()).fasting).toEqual({
      start: "20:00",
      end: "12:00",
    });

    // Once we are back online and drained, the day converges to DB truth: both.
    setOnline(true);
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(hook.result.current.syncState).toBe("saved"));
    await waitFor(() => {
      const day = hook.result.current.getDay("me", today());
      expect(day.fasting).toEqual({ start: "20:00", end: "12:00" });
      expect(day.meals.dinner.entries.map((e) => e.foodName)).toEqual(["מלפפון"]);
    });
    hook.unmount();
  });

  it("realtime covers fasting/workout and targets the partner profile (Test 4/6 shape)", async () => {
    const hook = await mountActive();
    // Partner (Elena) sets a workout, then clears it — both arrive via realtime.
    fake.rows("workout_logs").push({
      id: "w-1",
      household_id: HOUSEHOLD,
      profile_id: ALENA,
      log_date: today(),
      performed: true,
      workout_type: "ריצה",
      feeling: null,
    });
    act(() =>
      fake.emit("workout_logs", "INSERT", { id: "w-1", profile_id: ALENA, log_date: today() }),
    );
    await waitFor(() =>
      expect(hook.result.current.getDay("elena", today()).workout).toEqual({
        performed: true,
        type: "ריצה",
        feeling: undefined,
      }),
    );
    // Ariel's day was not touched by Elena's event.
    expect(hook.result.current.getDay("me", today()).workout).toBeUndefined();

    fake.rows("workout_logs").length = 0;
    act(() =>
      fake.emit("workout_logs", "DELETE", {}, { id: "w-1", profile_id: ALENA, log_date: today() }),
    );
    await waitFor(() =>
      expect(hook.result.current.getDay("elena", today()).workout).toBeUndefined(),
    );
    hook.unmount();
  });

  it("subscribes to every mutable daily table", async () => {
    const hook = await mountActive();
    expect([...fake.handlers.keys()].sort()).toEqual(
      [
        "fasting_logs",
        "food_entries",
        "food_preferences",
        "foods",
        "meal_statuses",
        "weigh_ins",
        "workout_logs",
      ].sort(),
    );
    hook.unmount();
  });

  it("a permanently rejected op stays visible as failed and can be discarded", async () => {
    const hook = await mountActive();
    // Make the fake reject the next write like a constraint violation would.
    const original = fake.execute.bind(fake);
    fake.execute = ((table: string, ...rest: unknown[]) => {
      if (table === "fasting_logs") {
        return { data: null, error: { code: "23514", message: "violates check constraint" } };
      }
      return (original as (...a: unknown[]) => unknown)(table, ...rest);
    }) as typeof fake.execute;
    act(() => hook.result.current.setFasting({ start: "25:00", end: "12:00" }));
    await waitFor(() => expect(hook.result.current.syncState).toBe("error"));
    expect(hook.result.current.syncDetail.failed).toBe(1);
    expect(queue.quarantined()[0].lastError).toContain("23514");
    act(() => hook.result.current.discardFailedSync());
    await waitFor(() => expect(hook.result.current.syncState).toBe("saved"));
    fake.execute = original;
    hook.unmount();
  });
});

/** Mounts while offline: activation still completes (fake reads succeed) but nothing drains. */
async function mountActiveOffline() {
  fake.offline = false; // reads for activation succeed…
  const hook = renderHook(() => useStore(), { wrapper });
  await waitFor(() => expect(fake.handlers.size).toBeGreaterThan(0));
  fake.offline = true; // …but writes fail while navigator says offline
  await new Promise((r) => setTimeout(r, 600));
  return hook;
}
