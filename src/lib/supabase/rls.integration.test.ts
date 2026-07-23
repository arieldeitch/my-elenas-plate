/**
 * Live integration test against a running Supabase instance. Verifies bootstrap,
 * CRUD and — most importantly — RLS isolation between households.
 *
 * Skipped unless SUPABASE_TEST_URL + SUPABASE_TEST_ANON_KEY are set, so the
 * normal (hermetic) test run is unaffected. Run locally with:
 *   supabase start
 *   SUPABASE_TEST_URL=... SUPABASE_TEST_ANON_KEY=... npx vitest run rls.integration
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
// Remote projects validate email domains (example.com is rejected) and may
// require email confirmation. Set SUPABASE_TEST_EMAIL_DOMAIN to an accepted
// domain and disable "Confirm email" to run this against the remote.
const EMAIL_DOMAIN = process.env.SUPABASE_TEST_EMAIL_DOMAIN || "example.com";
const run = Boolean(URL && ANON);

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function newUser() {
  const sb = anonClient();
  const email = `t_${Date.now()}_${Math.floor(Math.random() * 1e6)}@${EMAIL_DOMAIN}`;
  const { data, error } = await sb.auth.signUp({ email, password: "password123" });
  if (error) throw error;
  if (!data.session) {
    throw new Error(
      "sign-up returned no session — the project requires email confirmation; disable it to run this test",
    );
  }
  return sb;
}

describe.skipIf(!run)("Supabase RLS + bootstrap (live)", () => {
  let userA: SupabaseClient<Database>;
  let householdA: string;

  beforeAll(async () => {
    userA = await newUser();
    const { data, error } = await userA.rpc("bootstrap_household");
    expect(error).toBeNull();
    householdA = data as string;
  });

  it("bootstrap creates exactly two profiles (אריאל, אלנה) and is idempotent", async () => {
    const again = await userA.rpc("bootstrap_household");
    expect(again.data).toBe(householdA);

    const { data: profiles } = await userA.from("profiles").select("*").order("sort_order");
    expect(profiles?.map((p) => p.slug)).toEqual(["ariel", "alena"]);
    expect(profiles?.map((p) => p.display_name)).toEqual(["אריאל", "אלנה"]);
  });

  it("allows the shared account to write + read both profiles' data", async () => {
    const { data: profiles } = await userA.from("profiles").select("*").order("sort_order");
    const ariel = profiles![0].id;
    const alena = profiles![1].id;

    for (const pid of [ariel, alena]) {
      const { error } = await userA.from("food_entries").insert({
        household_id: householdA,
        profile_id: pid,
        log_date: "2026-07-23",
        slot: "main_meal",
        food_name: "קפה",
        quantity_mode: "measured",
        amount: 1,
        unit: "כוס",
        coffee: { type: "אמריקנו", milk: "ללא חלב" },
      });
      expect(error).toBeNull();
    }
    const { data: entries } = await userA.from("food_entries").select("profile_id");
    const owners = new Set(entries?.map((e) => e.profile_id));
    expect(owners.has(ariel)).toBe(true);
    expect(owners.has(alena)).toBe(true);
  });

  it("rejects a coffee entry with a milk type but no milk (DB constraint)", async () => {
    const { data: profiles } = await userA.from("profiles").select("id").order("sort_order");
    const { error } = await userA.from("food_entries").insert({
      household_id: householdA,
      profile_id: profiles![0].id,
      log_date: "2026-07-23",
      slot: "dinner",
      food_name: "קפה",
      quantity_mode: "measured",
      amount: 1,
      unit: "כוס",
      coffee: { type: "אמריקנו", milk: "ללא חלב", milkType: "סויה" },
    });
    expect(error).not.toBeNull();
  });

  it("isolates households: an unrelated account sees none of A's rows", async () => {
    const userB = await newUser();
    await userB.rpc("bootstrap_household");

    const { data: bSeesAProfiles } = await userB
      .from("profiles")
      .select("*")
      .eq("household_id", householdA);
    expect(bSeesAProfiles).toEqual([]);

    const { data: bSeesAEntries } = await userB
      .from("food_entries")
      .select("*")
      .eq("household_id", householdA);
    expect(bSeesAEntries).toEqual([]);

    // B only sees its own two profiles.
    const { data: bProfiles } = await userB.from("profiles").select("*");
    expect(bProfiles?.length).toBe(2);
  });

  it("denies anonymous (unauthenticated) reads", async () => {
    const anon = anonClient();
    const { data } = await anon.from("profiles").select("*");
    expect(data ?? []).toEqual([]);
  });
});
