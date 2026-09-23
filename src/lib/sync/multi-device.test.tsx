/**
 * Deterministic multi-device simulation (DEC-031) on the REAL store + sync hook +
 * repositories, with only auth and transport faked. The fake echoes every
 * mutation to all live realtime channels (like the socket), so "Device B sees
 * A's entry" is exercised end to end.
 *
 * Devices:
 *  - Device A = Ariel's phone: a mounted store with its own anonymous identity.
 *  - Device B = Elena's phone: a second identity acting through the same data
 *    layer the app uses (`bootstrapHousehold` + `applyOperation` + `hydrateDay`).
 *    jsdom has one localStorage, so two stores cannot be mounted at once
 *    without sharing the durable queue; B therefore uses the data layer directly.
 *  - Device C = a fresh phone joining later (a third identity, mounted after A).
 *
 * Also here: realtime lifecycle (token before subscribe, exactly one channel
 * across profile/date changes and token refreshes, teardown on session loss,
 * duplicate events, echo of own writes), offline/recovery sequences, and the
 * network budget of the daily loop.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { FakeSupabase } from "../../test/fake-supabase";
import { toISODate } from "../format";
import { DEVICE_PROFILE_KEY } from "../device-profile";
import type { FoodEntry } from "../domain";

const fake = new FakeSupabase();
const HOUSEHOLD = "11111111-1111-4111-8111-111111111111";
const ARIEL = "22222222-2222-4222-8222-222222222222";
const ALENA = "33333333-3333-4333-8333-333333333333";
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

vi.mock("../supabase/client", () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => fake,
  requireSupabase: () => fake,
  validateSupabaseEnv: () => ({ ok: true }),
}));
const auth = vi.hoisted(() => ({
  callback: null as null | ((s: unknown) => void),
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  token: "jwt-a",
}));
vi.mock("../supabase/auth", () => ({
  getSession: async () => ({ user: { id: auth.userId }, access_token: auth.token }),
  onAuthChange: (cb: (s: unknown) => void) => {
    auth.callback = cb;
    return () => {};
  },
}));

const { StoreProvider, useStore } = await import("../store");
const queue = await import("./queue");
const { bootstrapHousehold } = await import("../supabase/repositories");
const { applyOperation, hydrateDay } = await import("./supabase-sync");
const { opsForAddEntry, opsForSetSteps, opsForUpdateEntry } = await import("./operations");
const pointsLib = await import("../points");

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
const egg = { ...apple, foodId: "f_egg", foodName: "ביצה קשה" };

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

/** Mounts a device: its own identity, its own person choice, a live channel. */
async function mountDevice(userId: string, person: "me" | "elena") {
  window.localStorage.setItem(DEVICE_PROFILE_KEY, person);
  auth.userId = userId;
  auth.token = `jwt-${userId.slice(0, 1)}`;
  const hook = renderHook(() => useStore(), { wrapper });
  await waitFor(() => expect(hook.result.current.syncState).toBe("saved"));
  await waitFor(() => expect(fake.channels.size).toBeGreaterThan(0));
  return hook;
}

/** Device B (Elena's phone) acting through the app's data layer under its own identity. */
async function deviceB() {
  const saved = { userId: auth.userId, token: auth.token };
  auth.userId = USER_B;
  auth.token = "jwt-b";
  const ctx = await bootstrapHousehold();
  auth.userId = saved.userId;
  auth.token = saved.token;
  return {
    ctx,
    add: (profile: "me" | "elena", slot: "lunch" | "dinner", entry: FoodEntry) =>
      Promise.all(
        opsForAddEntry({ profile, iso: today() }, slot, entry).map((op) => applyOperation(ctx, op)),
      ),
    update: (profile: "me" | "elena", slot: "lunch" | "dinner", entry: FoodEntry) =>
      Promise.all(
        opsForUpdateEntry({ profile, iso: today() }, slot, entry).map((op) =>
          applyOperation(ctx, op),
        ),
      ),
    steps: (
      profile: "me" | "elena",
      log: { goalSteps: number; steps?: number; completed: boolean },
    ) =>
      Promise.all(
        opsForSetSteps({ profile, iso: today() }, log).map((op) => applyOperation(ctx, op)),
      ),
    view: (profile: "me" | "elena") => hydrateDay(ctx, profile, today()),
  };
}

const reads = () => fake.log.filter((l) => l.action === "select").length;
const writes = () => fake.log.filter((l) => l.action !== "select").length;

beforeEach(() => {
  window.localStorage.clear();
  seedHousehold();
  fake.log.length = 0;
  fake.events.length = 0;
  fake.channels.clear();
  fake.channelCount = 0;
  fake.offline = false;
  fake.autoEmit = true;
  setOnline(true);
});
afterEach(() => {
  setOnline(true);
  fake.offline = false;
  fake.autoEmit = false;
});

describe("multi-device: A = Ariel, B = Elena, C = fresh phone", () => {
  it("A adds → B sees it on Ariel's day; B adds → A sees it live on the partner day; C joins later and sees both", async () => {
    const A = await mountDevice(USER_A, "me");
    const B = await deviceB();
    expect(B.ctx.householdId).toBe(HOUSEHOLD); // same household, own identity

    // A (Ariel) logs lunch.
    act(() => A.result.current.addEntry("lunch", apple));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    const bSeesAriel = await B.view("me");
    expect(bSeesAriel!.meals.lunch.entries.map((e) => e.foodName)).toEqual(["תפוח עץ"]);

    // B (Elena) logs dinner from her phone → A's partner day updates via realtime, no reload.
    const eggEntry: FoodEntry = { id: "b-egg-1", ...egg };
    await B.add("elena", "dinner", eggEntry);
    await waitFor(() =>
      expect(A.result.current.getDay("elena", today()).meals.dinner.entries).toHaveLength(1),
    );
    // Ownership never crossed: A's own dinner is still empty, Elena's lunch is empty.
    expect(A.result.current.getDay("me", today()).meals.dinner.entries).toHaveLength(0);
    expect(A.result.current.getDay("elena", today()).meals.lunch.entries).toHaveLength(0);
    // Rows carry product identity (profile_id), never the auth user id.
    for (const row of fake.rows("food_entries")) {
      expect([ARIEL, ALENA]).toContain(row.profile_id);
      expect(row).not.toHaveProperty("user_id");
    }
    A.unmount();

    // C: a third identity, fresh phone, chooses Elena on its chooser → same cloud state.
    const C = await mountDevice(USER_C, "elena");
    await waitFor(() =>
      expect(C.result.current.getDay("elena", today()).meals.dinner.entries).toHaveLength(1),
    );
    await waitFor(() =>
      expect(C.result.current.getDay("me", today()).meals.lunch.entries).toHaveLength(1),
    );
    expect(C.result.current.activeProfile).toBe("elena");
    expect(fake.rows("households")).toHaveLength(1);
    expect(fake.rows("profiles")).toHaveLength(2);
    C.unmount();
  });

  it("daily steps stay person-scoped and propagate between devices through realtime", async () => {
    const A = await mountDevice(USER_A, "me");
    const B = await deviceB();

    act(() => A.result.current.setSteps({ goalSteps: 10_000, steps: 8_734, completed: false }));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    const bSeesAriel = await B.view("me");
    expect(bSeesAriel!.steps).toEqual({
      goalSteps: 10_000,
      steps: 8_734,
      completed: false,
    });

    await B.steps("elena", { goalSteps: 12_000, completed: true });
    await waitFor(() =>
      expect(A.result.current.getDay("elena", today()).steps).toEqual({
        goalSteps: 12_000,
        steps: undefined,
        completed: true,
      }),
    );
    expect(A.result.current.getDay("me", today()).steps?.steps).toBe(8_734);

    const rows = fake.rows("daily_steps");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.profile_id === ARIEL)).toMatchObject({
      steps: 8734,
      completed: false,
    });
    expect(rows.find((r) => r.profile_id === ALENA)).toMatchObject({
      steps: null,
      completed: true,
    });
    A.unmount();
  });

  it("A switches to Elena explicitly and changes her quantity → only Elena's row changes; B's reload shows it", async () => {
    const B = await deviceB();
    await B.add("elena", "dinner", { id: "b-egg-1", ...egg });
    const A = await mountDevice(USER_A, "me");
    act(() => A.result.current.addEntry("dinner", apple));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    await waitFor(() =>
      expect(A.result.current.getDay("elena", today()).meals.dinner.entries).toHaveLength(1),
    );

    // Explicit switch (what the Day Review / switcher does), then +1.
    act(() => A.result.current.setActiveProfile("elena"));
    const elenaEntry = A.result.current.getDay("elena", today()).meals.dinner.entries[0];
    act(() => A.result.current.updateEntry("dinner", { ...elenaEntry, amount: 2 }));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));

    const rows = fake.rows("food_entries");
    expect(rows.find((r) => r.profile_id === ALENA)).toMatchObject({ amount: 2 });
    expect(rows.find((r) => r.profile_id === ARIEL)).toMatchObject({ amount: 1 });
    // Device B reloads its day: truth persisted.
    const bView = await B.view("elena");
    expect(bView!.meals.dinner.entries[0]).toMatchObject({ foodName: "ביצה קשה", amount: 2 });
    // Device profile stayed local to A (switching person is not a device choice).
    expect(window.localStorage.getItem(DEVICE_PROFILE_KEY)).toBe("me");
    A.unmount();
  });
});

describe("realtime lifecycle", () => {
  it("sets the token before subscribing and keeps exactly one channel across profile switch, date navigation and token refresh", async () => {
    const A = await mountDevice(USER_A, "me");
    const i = fake.events.findIndex((e) => e.startsWith("setAuth:"));
    const j = fake.events.findIndex((e) => e.startsWith("subscribe:"));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(j).toBeGreaterThan(i);
    expect(fake.channels.size).toBe(1);

    act(() => A.result.current.setActiveProfile("elena"));
    act(() => A.result.current.setSelectedDate(new Date(Date.now() - 86_400_000)));
    act(() => A.result.current.setSelectedDate(new Date()));
    // TOKEN_REFRESHED: the auth listener fires with a session again.
    act(() => auth.callback!({ user: { id: USER_A }, access_token: "jwt-a-refreshed" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(fake.channels.size).toBe(1);
    expect(fake.channelCount).toBe(1);
    A.unmount();
    expect(fake.channels.size).toBe(0); // unmount tears the channel down
  });

  it("session replacement tears the old channel down and subscribes once with the new token", async () => {
    const A = await mountDevice(USER_A, "me");
    act(() => auth.callback!(null));
    expect(fake.channels.size).toBe(0);
    auth.userId = USER_C;
    auth.token = "jwt-c";
    act(() => auth.callback!({ user: { id: USER_C }, access_token: "jwt-c" }));
    await waitFor(() => expect(fake.channels.size).toBe(1));
    expect(fake.channelCount).toBe(2);
    expect(fake.events.filter((e) => e.startsWith("setAuth:")).pop()).toBe("setAuth:jwt-c");
    A.unmount();
  });

  it("duplicate realtime events and the echo of an own write never duplicate rows; rapid updates converge", async () => {
    const A = await mountDevice(USER_A, "me");
    act(() => A.result.current.addEntry("lunch", apple));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    await new Promise((r) => setTimeout(r, 20)); // let the auto-echo land
    const row = fake.rows("food_entries")[0];
    fake.emit("food_entries", "INSERT", row);
    fake.emit("food_entries", "INSERT", row);
    fake.emit("food_entries", "UPDATE", row);
    await new Promise((r) => setTimeout(r, 20));
    expect(A.result.current.getDay("me", today()).meals.lunch.entries).toHaveLength(1);

    // Rapid +1 +1 +1: one coalesced write, one final value everywhere.
    const before = writes();
    const e = A.result.current.getDay("me", today()).meals.lunch.entries[0];
    act(() => A.result.current.updateEntry("lunch", { ...e, amount: 2 }));
    act(() => A.result.current.updateEntry("lunch", { ...e, amount: 3 }));
    act(() => A.result.current.updateEntry("lunch", { ...e, amount: 4 }));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    await new Promise((r) => setTimeout(r, 20));
    expect(writes() - before).toBe(1);
    expect(fake.rows("food_entries")[0]).toMatchObject({ amount: 4 });
    expect(A.result.current.getDay("me", today()).meals.lunch.entries[0].amount).toBe(4);
    A.unmount();
  });
});

describe("offline / recovery sequences", () => {
  it("Scenario 1 — online log → sync → offline log → close/reopen → online → queue drains once", async () => {
    let A = await mountDevice(USER_A, "me");
    act(() => A.result.current.addEntry("lunch", apple));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));

    setOnline(false);
    fake.offline = true;
    act(() => A.result.current.addEntry("dinner", egg));
    await waitFor(() => expect(A.result.current.syncState).toBe("offline"));
    expect(fake.rows("food_entries")).toHaveLength(1);
    A.unmount(); // close the app while offline

    // Reopen still offline: the second entry is there locally, still pending.
    fake.offline = false; // activation reads succeed…
    A = renderHook(() => useStore(), { wrapper });
    await waitFor(() => expect(fake.channels.size).toBeGreaterThan(0));
    fake.offline = true; // …writes still fail while offline
    await new Promise((r) => setTimeout(r, 600));
    expect(A.result.current.syncState).not.toBe("saved");
    expect(fake.rows("food_entries")).toHaveLength(1);

    setOnline(true);
    fake.offline = false;
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"), { timeout: 5000 });
    expect(fake.rows("food_entries")).toHaveLength(2);
    expect(fake.rows("food_entries").filter((r) => r.food_name === "ביצה קשה")).toHaveLength(1);
    expect(queue.pending()).toHaveLength(0);
    A.unmount();
  });

  it("Scenario 2 — offline before boot with a stored session: the app degrades to 'offline', nothing is lost, and recovers", async () => {
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
    setOnline(false);
    fake.offline = true;
    const A = renderHook(() => useStore(), { wrapper });
    await new Promise((r) => setTimeout(r, 300));
    // Activation could not complete (no network); logging still works locally.
    act(() => A.result.current.addEntry("lunch", apple));
    expect(A.result.current.getDay("me", today()).meals.lunch.entries).toHaveLength(1);
    await waitFor(() => expect(A.result.current.syncState).toBe("offline"));
    expect(queue.pending().length).toBeGreaterThan(0);

    setOnline(true);
    fake.offline = false;
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"), { timeout: 8000 });
    expect(fake.rows("food_entries")).toHaveLength(1);
    A.unmount();
  });

  it("Scenario 3 — storage cleared → new identity → same household → the existing cloud day reappears", async () => {
    const A = await mountDevice(USER_A, "me");
    act(() => A.result.current.addEntry("lunch", apple));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    A.unmount();
    window.localStorage.clear();
    const A2 = await mountDevice(USER_C, "me");
    await waitFor(() =>
      expect(A2.result.current.getDay("me", today()).meals.lunch.entries).toHaveLength(1),
    );
    expect(fake.rows("households")).toHaveLength(1);
    A2.unmount();
  });

  it("Scenario 4 — pending queue under an old identity, auth session lost, new identity joins → the queue is adopted and drained, nothing duplicated", async () => {
    const A = await mountDevice(USER_A, "me");
    setOnline(false);
    fake.offline = true;
    act(() => A.result.current.addEntry("lunch", apple));
    await waitFor(() => expect(A.result.current.syncState).toBe("offline"));
    const pendingBefore = queue.pending();
    expect(pendingBefore.every((m) => m.owner === USER_A)).toBe(true);
    A.unmount();

    // Only the auth session is gone (queue survives): new identity on next open.
    setOnline(true);
    fake.offline = false;
    const A2 = await mountDevice(USER_C, "me");
    await waitFor(() => expect(A2.result.current.syncState).toBe("saved"), { timeout: 5000 });
    expect(queue.pending()).toHaveLength(0);
    expect(queue.quarantined()).toHaveLength(0);
    expect(fake.rows("food_entries")).toHaveLength(1);
    expect(fake.rows("food_entries")[0]).toMatchObject({ profile_id: ARIEL, food_name: "תפוח עץ" });
    A2.unmount();
  });

  it("Scenario 5 — network dies during +++ → reconnect → one correct final quantity", async () => {
    const A = await mountDevice(USER_A, "me");
    act(() => A.result.current.addEntry("lunch", apple));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    const e = A.result.current.getDay("me", today()).meals.lunch.entries[0];
    act(() => A.result.current.updateEntry("lunch", { ...e, amount: 2 }));
    setOnline(false);
    fake.offline = true;
    act(() => A.result.current.updateEntry("lunch", { ...e, amount: 3 }));
    act(() => A.result.current.updateEntry("lunch", { ...e, amount: 4 }));
    await waitFor(() => expect(A.result.current.syncState).toBe("offline"));
    // One coalesced op with the final value.
    expect(queue.pending().filter((m) => m.op.kind === "entry.upsert")).toHaveLength(1);

    setOnline(true);
    fake.offline = false;
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"), { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 20));
    expect(fake.rows("food_entries")).toHaveLength(1);
    expect(fake.rows("food_entries")[0]).toMatchObject({ amount: 4 });
    expect(A.result.current.getDay("me", today()).meals.lunch.entries[0].amount).toBe(4);
    A.unmount();
  });
});

describe("reference snapshots follow the FINAL entry state (DEC-036); never estimated", () => {
  // f_apple is a legacy id: it resolves to the reference food תפוח עץ (100 גרם = 2).
  const fruit = { ...apple, foodId: "f_apple", amount: 100, unit: "גרם" as const };
  const bread = {
    foodId: "f_white_bread",
    foodName: "לחם לבן", // verified alias → לחם אחיד - לבן שחור, 1 פרוסה (30 גרם) = 2
    mode: "measured" as const,
    amount: 1,
    unit: "פרוסה" as const,
  };
  const row = () => fake.rows("food_entries")[0];
  const settled = async (hook: { result: { current: { syncState: string } } }) => {
    await waitFor(() => expect(hook.result.current.syncState).toBe("saved"));
    await new Promise((r) => setTimeout(r, 30));
  };

  it("new entry, amount edit, unsafe unit → unscored, measured→subjective, level edit, subjective→measured: row = final state, version ref-v1", async () => {
    const A = await mountDevice(USER_A, "me");
    act(() => A.result.current.addEntry("lunch", fruit));
    await settled(A);
    expect(row()).toMatchObject({
      food_name: "תפוח עץ",
      points_value: 2,
      points_model_version: "ref-v1",
      points_basis: "reference:exact",
    });
    const e = () => A.result.current.getDay("me", today()).meals.lunch.entries[0];

    act(() => A.result.current.updateEntry("lunch", { ...e(), amount: 300 }));
    await settled(A);
    expect(row()).toMatchObject({ amount: 300, points_value: 6, points_basis: "reference:scaled" });

    // A unit the reference cannot convert (יחידה for a gram portion) is never estimated.
    act(() => A.result.current.updateEntry("lunch", { ...e(), amount: 1, unit: "יחידה" }));
    await settled(A);
    expect(row()).toMatchObject({
      unit: "יחידה",
      points_value: null,
      points_basis: "reference:blocked",
    });

    act(() =>
      A.result.current.updateEntry("lunch", {
        ...e(),
        mode: "subjective",
        subjective: "הרבה",
        amount: undefined,
        unit: undefined,
      }),
    );
    await settled(A);
    expect(row()).toMatchObject({ quantity_mode: "subjective", points_value: 3 });

    act(() => A.result.current.updateEntry("lunch", { ...e(), subjective: "מוגזם" }));
    await settled(A);
    expect(row()).toMatchObject({ points_value: 4 });

    act(() =>
      A.result.current.updateEntry("lunch", {
        ...e(),
        mode: "measured",
        amount: 50,
        unit: "גרם",
        subjective: undefined,
      }),
    );
    await settled(A);
    expect(row()).toMatchObject({ quantity_mode: "measured", amount: 50, points_value: 1 });
    expect(row().points_model_version).toBe("ref-v1");
    A.unmount();
  });

  it("a legacy v1 snapshot is hydrated as saved (fruit = 0) and only a deliberate edit re-scores it through the reference", async () => {
    fake.rows("food_entries").push({
      id: "legacy-v1",
      household_id: HOUSEHOLD,
      profile_id: ARIEL,
      log_date: today(),
      slot: "main_meal",
      food_id: "f_apple",
      food_name: "תפוח",
      quantity_mode: "measured",
      amount: 1,
      unit: "יחידה",
      points_value: 0,
      points_model_version: "v1",
      created_at: new Date().toISOString(),
    });
    const A = await mountDevice(USER_A, "me");
    await waitFor(() =>
      expect(A.result.current.getDay("me", today()).meals.lunch.entries).toHaveLength(1),
    );
    const e = A.result.current.getDay("me", today()).meals.lunch.entries[0];
    expect(e).toMatchObject({ pointsValue: 0, pointsModelVersion: "v1", foodName: "תפוח" });
    expect(pointsLib.pointsForEntry(e)).toBe(0);
    // Activation/hydration wrote nothing back; the history keeps its old name.
    expect(fake.rows("food_entries")[0]).toMatchObject({
      points_value: 0,
      points_model_version: "v1",
      food_name: "תפוח",
    });
    expect(writes()).toBe(0);
    // Deliberate edit to a resolvable quantity → reference snapshot (100 גרם = 2).
    act(() => A.result.current.updateEntry("lunch", { ...e, amount: 100, unit: "גרם" }));
    await settled(A);
    expect(fake.rows("food_entries")[0]).toMatchObject({
      points_value: 2,
      points_model_version: "ref-v1",
      points_basis: "reference:exact",
    });
    A.unmount();
  });

  it("offline write + queue replay and a realtime roundtrip keep the reference snapshot", async () => {
    const A = await mountDevice(USER_A, "me");
    setOnline(false);
    fake.offline = true;
    act(() => A.result.current.addEntry("dinner", bread));
    await waitFor(() => expect(A.result.current.syncState).toBe("offline"));
    setOnline(true);
    fake.offline = false;
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"), { timeout: 5000 });
    expect(row()).toMatchObject({
      food_name: "לחם אחיד - לבן שחור",
      points_value: 2,
      points_model_version: "ref-v1",
    });

    // Device B writes a scored Elena entry; A receives it with the snapshot intact.
    const B = await deviceB();
    const canonical = A.result.current.resolveFoodId("f_apple")!;
    const f = A.result.current.foods.find((x) => x.id === canonical);
    await B.add(
      "elena",
      "lunch",
      pointsLib.scoreEntry({ id: "b-1", ...fruit, foodId: canonical, amount: 200 }, f),
    );
    await waitFor(() =>
      expect(A.result.current.getDay("elena", today()).meals.lunch.entries[0]).toMatchObject({
        pointsValue: 4,
        pointsModelVersion: "ref-v1",
      }),
    );
    A.unmount();
  });
});

describe("manual daily target — isolation, realtime and no automatic value (DEC-037)", () => {
  it("Ariel's target is his alone, body facts never move it, and Elena's arrives via realtime", async () => {
    const A = await mountDevice(USER_A, "me");
    // DEC-037: with no manual target there is NO number at all.
    expect(A.result.current.getPointsBudget("me")).toBeNull();
    expect(A.result.current.getPointsBudgetInfo("me").source).toBe("none");

    // Body facts are stored and synced, but they are not the target.
    act(() =>
      A.result.current.setProfileFacts({
        sexAtBirth: "male",
        birthDate: "1980-06-15",
        heightCm: 178,
        goalMode: "lose",
      }),
    );
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    const ariel = fake.rows("profiles").find((p) => p.id === ARIEL)!;
    const alena = fake.rows("profiles").find((p) => p.id === ALENA)!;
    expect(ariel).toMatchObject({ sex_at_birth: "male", birth_date: "1980-06-15", height_cm: 178 });
    expect(alena.sex_at_birth).toBeUndefined();
    expect(A.result.current.getPointsBudget("me")).toBeNull();

    // A weigh-in does not create a target either.
    act(() => A.result.current.addWeighIn({ dateISO: today(), weightKg: 84 }));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    expect(A.result.current.getPointsBudget("me")).toBeNull();

    // The manual target is the only thing that sets it, and it is per profile.
    act(() => A.result.current.setPointsBudget(27));
    expect(A.result.current.getPointsBudgetInfo("me")).toMatchObject({
      budget: 27,
      source: "manual",
    });
    expect(A.result.current.getPointsBudget("elena")).toBeNull();
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    expect(fake.rows("profiles").find((p) => p.id === ARIEL)!.points_budget_override).toBe(27);
    expect(fake.rows("profiles").find((p) => p.id === ALENA)!.points_budget_override).toBeFalsy();

    // Clearing goes back to "no target", never to an automatic number.
    act(() => A.result.current.setPointsBudget(null));
    expect(A.result.current.getPointsBudget("me")).toBeNull();
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    expect(fake.rows("profiles").find((p) => p.id === ARIEL)!.points_budget_override).toBeNull();

    // Elena sets hers on her own device; the realtime event updates only her.
    act(() => A.result.current.setPointsBudget(27));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    Object.assign(fake.rows("profiles").find((p) => p.id === ALENA)!, {
      points_budget_override: 31,
    });
    fake.emit("profiles", "UPDATE", { id: ALENA, slug: "alena", household_id: HOUSEHOLD });
    await waitFor(() => expect(A.result.current.getPointsBudget("elena")).toBe(31));
    expect(A.result.current.getPointsBudget("me")).toBe(27);
    expect(fake.channels.size).toBe(1);
    A.unmount();
  });
});

describe("dishes / estimated products / bridges sync (DEC-037 R10)", () => {
  it("a dish, a product and a bridge reach the server once and land on the partner's device", async () => {
    const A = await mountDevice(USER_A, "me");
    act(() => {
      A.result.current.saveEstimatedProduct({
        name: "קרקר מהסופר",
        label: { basis: "per_100g", calories: 400 },
      });
    });
    act(() => {
      A.result.current.saveWeightBridge({
        sourceKind: "reference",
        sourceKey: "טחינה",
        unit: "כף",
        gramsPerUnit: 15,
        provenance: "user_measured",
      });
    });
    act(() => {
      A.result.current.saveDish({
        name: "תבשיל עדשים",
        ingredients: [
          {
            sourceKind: "reference",
            name: "עדשים",
            amount: 200,
            unit: "גרם",
            basisText: "100 גרם",
            points: 6,
          },
        ],
        finalWeightG: 800,
        usualServingWeightG: 250,
      });
    });
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));

    const dishRow = fake.rows("dishes")[0] as { id: string; revision: number };
    expect(fake.rows("dishes")).toHaveLength(1);
    expect(dishRow).toMatchObject({
      household_id: HOUSEHOLD,
      name: "תבשיל עדשים",
      revision: 1,
      total_points: 6,
      final_weight_g: 800,
      created_by_profile_id: ARIEL,
    });
    expect(fake.rows("dish_versions")).toHaveLength(1);
    expect(fake.rows("dish_versions")[0]).toMatchObject({ dish_id: dishRow.id, revision: 1 });
    expect(fake.rows("estimated_products")[0]).toMatchObject({
      name: "קרקר מהסופר",
      label_basis: "per_100g",
      label_calories: 400,
      created_by_profile_id: ARIEL,
    });
    expect(fake.rows("weight_bridges")[0]).toMatchObject({
      source_kind: "reference",
      source_key: "טחינה",
      unit: "כף",
      grams_per_unit: 15,
      provenance: "user_measured",
    });

    // Editing the dish adds a SECOND immutable version, never a second dish.
    act(() => {
      A.result.current.saveDish({
        id: dishRow.id,
        name: "תבשיל עדשים",
        ingredients: [
          {
            sourceKind: "reference",
            name: "עדשים",
            amount: 400,
            unit: "גרם",
            basisText: "100 גרם",
            points: 12,
          },
        ],
        finalWeightG: 800,
      });
    });
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    expect(fake.rows("dishes")).toHaveLength(1);
    expect(fake.rows("dish_versions")).toHaveLength(2);
    expect(fake.rows("dishes")[0].revision).toBe(2);

    // The partner's device hydrates them (household-wide, not day-scoped).
    const B = await mountDevice(USER_B, "elena");
    await waitFor(() => expect(B.result.current.dishes).toHaveLength(1));
    expect(B.result.current.dishes[0]).toMatchObject({ name: "תבשיל עדשים", revision: 2 });
    expect(B.result.current.estimatedProducts).toHaveLength(1);
    expect(B.result.current.weightBridges).toHaveLength(1);
    // …and no duplicate was created by the hydrate/replay.
    expect(fake.rows("dishes")).toHaveLength(1);
    A.unmount();
    B.unmount();
  });
});

describe("network budget (reads / writes / subscriptions)", () => {
  it("activation, partner switch, quick add and rapid quantity stay within the expected budget", async () => {
    const A = await mountDevice(USER_A, "me");
    const activationReads = reads();
    const activationWrites = writes();
    // profiles + foods + points-budget refresh + own day (6 incl. daily_steps + latest goal)
    // + weigh-ins + prefs + partner day (6) ≈ 17
    expect(activationReads).toBeLessThanOrEqual(20);
    expect(activationWrites).toBe(0);
    expect(fake.channels.size).toBe(1);
    // Profile facts arrive with the bootstrap read — exactly ONE profiles query.
    expect(fake.log.filter((l) => l.table === "profiles" && l.action === "select")).toHaveLength(1);

    // Partner switch: at most the partner's day/weigh-ins/prefs + the other day again.
    fake.log.length = 0;
    act(() => A.result.current.setActiveProfile("elena"));
    await new Promise((r) => setTimeout(r, 50));
    expect(reads()).toBeLessThanOrEqual(14);
    expect(writes()).toBe(0);

    // Quick add: 3 writes (entry upsert, status set, recent pref) and only the
    // touched day re-read afterwards.
    fake.log.length = 0;
    act(() => A.result.current.setActiveProfile("me"));
    await new Promise((r) => setTimeout(r, 50));
    fake.log.length = 0;
    act(() => A.result.current.addEntry("lunch", apple));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    await new Promise((r) => setTimeout(r, 30));
    expect(writes()).toBeLessThanOrEqual(3);
    expect(reads()).toBeLessThanOrEqual(8);

    // Rapid +1 ×3 → one write.
    fake.log.length = 0;
    const e = A.result.current.getDay("me", today()).meals.lunch.entries[0];
    for (const amount of [2, 3, 4])
      act(() => A.result.current.updateEntry("lunch", { ...e, amount }));
    await waitFor(() => expect(A.result.current.syncState).toBe("saved"));
    expect(writes()).toBe(1);
    expect(fake.channels.size).toBe(1);
    console.info(
      `[budget] activation reads=${activationReads} · quick add writes≤3 · +++ writes=1 · channels=1`,
    );
    A.unmount();
  });
});
