/**
 * End-to-end data-layer verification against a live Supabase project (remote or
 * local). Exercises the real mappers + migration transform + RLS + realtime over
 * authenticated sessions. Skipped unless SUPABASE_TEST_URL + SUPABASE_TEST_ANON_KEY
 * are set; set SUPABASE_TEST_EMAIL_DOMAIN to a domain the project accepts.
 *
 * Runs in the `node` environment: realtime uses a WebSocket, and jsdom's Event
 * class clashes with undici's WebSocket. node aligns them.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { deriveFavoritesRecents, entryFromRow, entryToRow, preferenceFromRow } from "./mappers";
import type { FoodPreferenceRow } from "./database.types";
import { buildMigrationPayload, totalRows } from "../sync/migrate-local";
import type { PersistedState } from "../persistence";
import type { DailyMeal, DayData, FoodEntry, MealSlotId, ProfileId } from "../domain";
import { MEAL_SLOTS } from "../domain";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const DOMAIN = process.env.SUPABASE_TEST_EMAIL_DOMAIN || "example.com";
const run = Boolean(URL && ANON);

function client(): SupabaseClient<Database> {
  return createClient<Database>(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function newAccount() {
  const email = `live_${Date.now()}_${Math.floor(Math.random() * 1e6)}@${DOMAIN}`;
  const password = "password123";
  const a = client();
  const { data, error } = await a.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("no session — disable email confirmation to run this test");
  const { data: hid, error: bErr } = await a.rpc("bootstrap_household");
  if (bErr) throw bErr;
  const { data: profiles } = await a.from("profiles").select("*").order("sort_order");
  return {
    client: a,
    email,
    password,
    householdId: hid as string,
    ariel: profiles![0].id as string,
    alena: profiles![1].id as string,
  };
}

const uuid = () => crypto.randomUUID();

describe.skipIf(!run)("Supabase live data layer (remote)", () => {
  let acc: Awaited<ReturnType<typeof newAccount>>;

  beforeAll(async () => {
    acc = await newAccount();
  });

  it("CRUD across every table for a profile", async () => {
    const sb = acc.client;
    const date = "2026-07-20";

    // meal status
    await sb
      .from("meal_statuses")
      .upsert(
        {
          household_id: acc.householdId,
          profile_id: acc.ariel,
          log_date: date,
          slot: "main_meal",
          status: "logged",
        },
        { onConflict: "profile_id,log_date,slot" },
      )
      .throwOnError();

    // food entry (measured) via the real mapper
    const entry: FoodEntry = {
      id: uuid(),
      foodId: "f",
      foodName: "אורז",
      mode: "measured",
      amount: 2,
      unit: "כוס",
    };
    await sb
      .from("food_entries")
      .insert(
        entryToRow(entry, {
          householdId: acc.householdId,
          profileId: acc.ariel,
          logDate: date,
          slot: "lunch",
        }),
      )
      .throwOnError();
    // update
    await sb.from("food_entries").update({ amount: 3 }).eq("id", entry.id).throwOnError();
    const { data: read } = await sb.from("food_entries").select("*").eq("id", entry.id).single();
    expect(read!.amount).toBe(3);
    // delete
    await sb.from("food_entries").delete().eq("id", entry.id).throwOnError();

    // fasting
    await sb
      .from("fasting_logs")
      .upsert(
        {
          household_id: acc.householdId,
          profile_id: acc.ariel,
          log_date: date,
          start_time: "20:00",
          end_time: "12:00",
        },
        { onConflict: "profile_id,log_date" },
      )
      .throwOnError();

    // workout
    await sb
      .from("workout_logs")
      .upsert(
        {
          household_id: acc.householdId,
          profile_id: acc.ariel,
          log_date: date,
          performed: true,
          workout_type: "הליכה",
          feeling: "טוב",
        },
        { onConflict: "profile_id,log_date" },
      )
      .throwOnError();

    // weigh-in
    await sb
      .from("weigh_ins")
      .insert({
        household_id: acc.householdId,
        profile_id: acc.ariel,
        measured_on: date,
        weight_kg: 82.4,
        body_fat_pct: 24,
      })
      .throwOnError();
    const { data: weighs } = await sb.from("weigh_ins").select("*").eq("profile_id", acc.ariel);
    expect(weighs!.length).toBeGreaterThan(0);

    // favorite (food_preferences) — needs a food row first
    const foodId = uuid();
    await sb
      .from("foods")
      .insert({
        id: foodId,
        household_id: acc.householdId,
        name: "קפה",
        normalized_name: "קפה",
        kind: "coffee",
      })
      .throwOnError();
    await sb
      .from("food_preferences")
      .upsert(
        {
          household_id: acc.householdId,
          profile_id: acc.ariel,
          food_id: foodId,
          is_favorite: true,
          use_count: 1,
        },
        { onConflict: "profile_id,food_id" },
      )
      .throwOnError();
    const { data: favs } = await sb.from("food_preferences").select("*").eq("is_favorite", true);
    expect(favs!.length).toBeGreaterThan(0);
  });

  it("coffee round-trips through the DB and enforces milk-type compatibility", async () => {
    const sb = acc.client;
    const id = uuid();
    const coffee: FoodEntry = {
      id,
      foodId: "f_coffee",
      foodName: "קפה",
      mode: "measured",
      amount: 1,
      unit: "ספל",
      coffee: { type: "לאטה", milk: "עם חלב", milkType: "שקדים" },
    };
    await sb
      .from("food_entries")
      .insert(
        entryToRow(coffee, {
          householdId: acc.householdId,
          profileId: acc.alena,
          logDate: "2026-07-21",
          slot: "afternoon_snack",
        }),
      )
      .throwOnError();
    const { data: row } = await sb.from("food_entries").select("*").eq("id", id).single();
    const back = entryFromRow(row!);
    expect(back.coffee).toEqual({ type: "לאטה", milk: "עם חלב", milkType: "שקדים" });

    // A RAW invalid coffee (milk type without milk) is rejected by the DB CHECK.
    // (entryToRow would sanitise it away, which is the app-level safeguard — so we
    // insert the raw jsonb here to exercise the database constraint itself.)
    const bad = await sb.from("food_entries").insert({
      id: uuid(),
      household_id: acc.householdId,
      profile_id: acc.alena,
      log_date: "2026-07-21",
      slot: "dinner",
      food_name: "קפה",
      quantity_mode: "measured",
      amount: 1,
      unit: "כוס",
      coffee: { type: "אמריקנו", milk: "ללא חלב", milkType: "סויה" },
    });
    expect(bad.error).not.toBeNull();
  });

  it("upsert is idempotent — no optimistic duplication", async () => {
    const sb = acc.client;
    const entry: FoodEntry = {
      id: uuid(),
      foodId: "f",
      foodName: "בננה",
      mode: "measured",
      amount: 1,
      unit: "יחידה",
    };
    const row = entryToRow(entry, {
      householdId: acc.householdId,
      profileId: acc.ariel,
      logDate: "2026-07-22",
      slot: "breakfast",
    });
    await sb.from("food_entries").upsert(row).throwOnError();
    await sb.from("food_entries").upsert(row).throwOnError(); // same id again
    const { count } = await sb
      .from("food_entries")
      .select("*", { count: "exact", head: true })
      .eq("id", entry.id);
    expect(count).toBe(1);
  });

  it("local->cloud migration uploads a legacy state", async () => {
    const acc2 = await newAccount(); // fresh household to count cleanly
    const sb = acc2.client;
    const payload = buildMigrationPayload(sampleState(), acc2.householdId, {
      ariel: acc2.ariel,
      alena: acc2.alena,
    });
    expect(totalRows(payload)).toBeGreaterThan(0);

    await sb
      .from("meal_statuses")
      .upsert(payload.mealStatuses, { onConflict: "profile_id,log_date,slot" })
      .throwOnError();
    await sb
      .from("food_entries")
      .insert(payload.foodEntries.map(({ id: _id, ...r }) => r))
      .throwOnError();
    if (payload.fasting.length)
      await sb
        .from("fasting_logs")
        .upsert(payload.fasting, { onConflict: "profile_id,log_date" })
        .throwOnError();
    if (payload.workouts.length)
      await sb
        .from("workout_logs")
        .upsert(payload.workouts, { onConflict: "profile_id,log_date" })
        .throwOnError();
    if (payload.weighIns.length) await sb.from("weigh_ins").insert(payload.weighIns).throwOnError();

    const { count } = await sb.from("food_entries").select("*", { count: "exact", head: true });
    expect(count).toBeGreaterThan(0);
  });

  it("custom foods + favorites + recents sync per profile with isolation", async () => {
    const sb = acc.client;

    // 1. create a custom food (household-scoped)
    const foodId = uuid();
    await sb
      .from("foods")
      .insert({
        id: foodId,
        household_id: acc.householdId,
        name: "שייק בננה",
        normalized_name: "שייק בננה",
      })
      .throwOnError();
    const { data: foods } = await sb.from("foods").select("*").eq("household_id", acc.householdId);
    expect(foods!.some((f) => f.id === foodId)).toBe(true);

    // 2. Ariel favorites it + records recency
    await sb
      .from("food_preferences")
      .upsert(
        {
          household_id: acc.householdId,
          profile_id: acc.ariel,
          food_id: foodId,
          is_favorite: true,
        },
        { onConflict: "profile_id,food_id" },
      )
      .throwOnError();
    await sb
      .from("food_preferences")
      .upsert(
        {
          household_id: acc.householdId,
          profile_id: acc.ariel,
          food_id: foodId,
          last_used_at: new Date(2).toISOString(),
        },
        { onConflict: "profile_id,food_id" },
      )
      .throwOnError();

    // 3. Ariel's derived favorites/recents include it
    const { data: arielPrefs } = await sb
      .from("food_preferences")
      .select("*")
      .eq("profile_id", acc.ariel);
    const derived = deriveFavoritesRecents(
      (arielPrefs as FoodPreferenceRow[]).map(preferenceFromRow),
    );
    expect(derived.favorites).toContain(foodId);
    expect(derived.recents).toContain(foodId);

    // 4. Alena does NOT inherit Ariel's favorite/recent (profile separation)
    const { data: alenaPrefs } = await sb
      .from("food_preferences")
      .select("*")
      .eq("profile_id", acc.alena);
    expect((alenaPrefs ?? []).length).toBe(0);

    // 5. Alena has independent preferences
    await sb
      .from("food_preferences")
      .upsert(
        {
          household_id: acc.householdId,
          profile_id: acc.alena,
          food_id: foodId,
          is_favorite: true,
        },
        { onConflict: "profile_id,food_id" },
      )
      .throwOnError();
    const { count } = await sb
      .from("food_preferences")
      .select("*", { count: "exact", head: true })
      .eq("food_id", foodId);
    expect(count).toBe(2); // one row per profile, no duplicates

    // 6. Soft-delete (archive) keeps the row; historical entries (by name) still read
    await sb.from("foods").update({ is_active: false }).eq("id", foodId).throwOnError();
    const { data: active } = await sb
      .from("foods")
      .select("id")
      .eq("id", foodId)
      .eq("is_active", true);
    expect(active).toEqual([]);
  });

  it("isolation: an unrelated account sees none of the household's foods/prefs", async () => {
    const foodId = uuid();
    await acc.client
      .from("foods")
      .insert({ id: foodId, household_id: acc.householdId, name: "פרטי", normalized_name: "פרטי" })
      .throwOnError();

    const other = await newAccount();
    const { data: theirView } = await other.client
      .from("foods")
      .select("*")
      .eq("household_id", acc.householdId);
    expect(theirView).toEqual([]);
    const { data: theirPrefs } = await other.client
      .from("food_preferences")
      .select("*")
      .eq("household_id", acc.householdId);
    expect(theirPrefs).toEqual([]);
  });

  it(
    "realtime: a second context sees insert, update and delete",
    { retry: 2, timeout: 60000 },
    async () => {
      // Second client authenticated as the SAME shared account (same household).
      const b = client();
      await b.auth.signInWithPassword({ email: acc.email, password: acc.password });

      // Ensure the subscribing socket carries the auth token so RLS lets it see
      // the household's rows.
      const { data: sess } = await acc.client.auth.getSession();
      acc.client.realtime.setAuth(sess.session?.access_token);

      const events: string[] = [];
      const channel = acc.client
        .channel(`rt-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "food_entries" }, (p) =>
          events.push(p.eventType),
        );
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("subscribe timeout")), 20000);
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            clearTimeout(t);
            resolve();
          }
        });
      });

      const id = uuid();
      const row = entryToRow(
        { id, foodId: "f", foodName: "תפוח", mode: "measured", amount: 1, unit: "יחידה" },
        {
          householdId: acc.householdId,
          profileId: acc.ariel,
          logDate: "2026-07-23",
          slot: "dinner",
        },
      );
      await b.from("food_entries").insert(row).throwOnError();
      await b.from("food_entries").update({ amount: 2 }).eq("id", id).throwOnError();
      await b.from("food_entries").delete().eq("id", id).throwOnError();

      await waitFor(
        () => events.includes("INSERT") && events.includes("UPDATE") && events.includes("DELETE"),
        25000,
      );
      expect(events).toContain("INSERT");
      expect(events).toContain("UPDATE");
      expect(events).toContain("DELETE");
      await acc.client.removeChannel(channel);
    },
  );
});

function sampleState(): PersistedState {
  const meals = {} as Record<MealSlotId, DailyMeal>;
  for (const s of MEAL_SLOTS) meals[s] = { slot: s, status: "empty", entries: [] };
  meals.lunch = {
    slot: "lunch",
    status: "logged",
    entries: [
      {
        id: "e1",
        foodId: "f_coffee",
        foodName: "קפה",
        mode: "measured",
        amount: 1,
        unit: "כוס",
        coffee: { type: "אמריקנו", milk: "עם חלב", milkType: "שקדים" },
      },
    ],
  };
  const day: DayData = {
    meals,
    fasting: { start: "20:00", end: "12:00" },
    workout: { performed: true, type: "הליכה", feeling: "טוב" },
  };
  return {
    version: 1,
    activeProfile: "me" as ProfileId,
    days: { me: { "2026-07-19": day }, elena: {} } as PersistedState["days"],
    weighIns: {
      me: [{ id: "w1", dateISO: "2026-07-19", weightKg: 80, bodyFatPct: 22 }],
      elena: [],
    },
    favorites: { me: [], elena: [] },
    recents: { me: [], elena: [] },
    foods: [],
  };
}

async function waitFor(cond: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timeout");
    await new Promise((r) => setTimeout(r, 150));
  }
}
