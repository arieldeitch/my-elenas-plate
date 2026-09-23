/**
 * Data-access layer between the store and Supabase. Thin, typed CRUD keyed by
 * household/profile/date. Security is enforced by RLS, not here. All functions
 * require a configured, authenticated client (see requireSupabase()).
 */
import { requireSupabase } from "./client";
import type { ProfileFacts } from "../points";
import type {
  DayData,
  Dish,
  EstimatedProduct,
  Food,
  MealSlotId,
  ProfileId,
  StepLog,
  WeighIn,
  WeightBridge,
  WorkoutFeeling,
  WorkoutType,
} from "../domain";
import { MEAL_SLOTS } from "../domain";
import type {
  FoodEntryRow,
  FoodPreferenceRow,
  FoodRow,
  DailyStepRow,
  DishRow,
  DishVersionRow,
  EstimatedProductRow,
  MealStatusRow,
  ProfileRow,
  WeightBridgeRow,
} from "./database.types";
import {
  dishFromRows,
  dishToRow,
  dishVersionToRow,
  entryToRow,
  estimatedProductFromRow,
  estimatedProductToRow,
  foodFromRow,
  foodToRow,
  weightBridgeFromRow,
  weightBridgeToRow,
  mealFromRows,
  preferenceFromRow,
  slotToSlug,
  statusToDb,
  slugToSlot,
  type Preference,
} from "./mappers";

export interface HouseholdContext {
  householdId: string;
  profileIdBySlug: Record<string, string>;
  /** @deprecated v1 budget column; kept for fixtures. */
  pointsBudgetBySlug?: Record<string, number>;
  /** v2-il profile facts (sex / birth date / height / goal / override) by slug. */
  profileFactsBySlug?: Record<string, ProfileFacts>;
}

/** Maps a profiles row to the budget facts (DEC-034). */
export function profileFactsFromRow(p: Partial<ProfileRow>): ProfileFacts {
  return {
    sexAtBirth: (p.sex_at_birth as ProfileFacts["sexAtBirth"]) ?? null,
    birthDate: p.birth_date ?? null,
    heightCm: p.height_cm == null ? null : Number(p.height_cm),
    goalMode: (p.goal_mode as ProfileFacts["goalMode"]) ?? "lose",
    pointsBudgetOverride: p.points_budget_override ?? null,
  };
}

/** Ensures the household + two profiles exist and returns the mapping. */
export async function bootstrapHousehold(): Promise<HouseholdContext> {
  const sb = requireSupabase();
  const { data: householdId, error } = await sb.rpc("bootstrap_household");
  if (error) throw error;
  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("*")
    .eq("household_id", householdId as string)
    .order("sort_order");
  if (pErr) throw pErr;
  const profileIdBySlug: Record<string, string> = {};
  const pointsBudgetBySlug: Record<string, number> = {};
  const profileFactsBySlug: Record<string, ProfileFacts> = {};
  for (const p of (profiles ?? []) as ProfileRow[]) {
    profileIdBySlug[p.slug] = p.id;
    pointsBudgetBySlug[p.slug] = p.daily_points_budget ?? 30;
    profileFactsBySlug[p.slug] = profileFactsFromRow(p);
  }
  return {
    householdId: householdId as string,
    profileIdBySlug,
    pointsBudgetBySlug,
    profileFactsBySlug,
  };
}

/** Facts of every profile in the household (one read), keyed by slug. */
export async function loadProfileFacts(householdId: string): Promise<Record<string, ProfileFacts>> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select("slug,sex_at_birth,birth_date,height_cm,goal_mode,points_budget_override")
    .eq("household_id", householdId);
  if (error) throw error;
  const result: Record<string, ProfileFacts> = {};
  for (const row of data ?? []) result[row.slug] = profileFactsFromRow(row as Partial<ProfileRow>);
  return result;
}

/** Partial update of a profile's facts; only the given keys are written. */
export async function updateProfileFacts(
  profileId: string,
  patch: Partial<ProfileFacts>,
): Promise<void> {
  const sb = requireSupabase();
  const row: Partial<
    Pick<
      ProfileRow,
      "sex_at_birth" | "birth_date" | "height_cm" | "goal_mode" | "points_budget_override"
    >
  > = {};
  if ("sexAtBirth" in patch) row.sex_at_birth = patch.sexAtBirth ?? null;
  if ("birthDate" in patch) row.birth_date = patch.birthDate ?? null;
  if ("heightCm" in patch) row.height_cm = patch.heightCm ?? null;
  if ("goalMode" in patch) row.goal_mode = patch.goalMode ?? "lose";
  if ("pointsBudgetOverride" in patch)
    row.points_budget_override = patch.pointsBudgetOverride ?? null;
  if (Object.keys(row).length === 0) return;
  const { error } = await sb.from("profiles").update(row).eq("id", profileId);
  if (error) throw error;
}

/** Loads a single day's meals (statuses + entries) for a profile. */
export async function loadDay(profileId: string, logDate: string): Promise<DayData> {
  const sb = requireSupabase();
  const [statuses, entries, fasting, workout, steps, latestGoal] = await Promise.all([
    sb.from("meal_statuses").select("*").eq("profile_id", profileId).eq("log_date", logDate),
    sb.from("food_entries").select("*").eq("profile_id", profileId).eq("log_date", logDate),
    sb
      .from("fasting_logs")
      .select("*")
      .eq("profile_id", profileId)
      .eq("log_date", logDate)
      .maybeSingle(),
    sb
      .from("workout_logs")
      .select("*")
      .eq("profile_id", profileId)
      .eq("log_date", logDate)
      .maybeSingle(),
    sb
      .from("daily_steps")
      .select("*")
      .eq("profile_id", profileId)
      .eq("log_date", logDate)
      .maybeSingle(),
    sb
      .from("daily_steps")
      .select("goal_steps")
      .eq("profile_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (statuses.error) throw statuses.error;
  if (entries.error) throw entries.error;
  if (fasting.error) throw fasting.error;
  if (workout.error) throw workout.error;
  if (steps.error) throw steps.error;
  if (latestGoal.error) throw latestGoal.error;

  const statusBySlot = new Map<MealSlotId, MealStatusRow>();
  for (const s of (statuses.data ?? []) as MealStatusRow[]) {
    statusBySlot.set(slugToSlot(s.slot), s);
  }
  const entriesBySlot = new Map<MealSlotId, FoodEntryRow[]>();
  for (const e of (entries.data ?? []) as FoodEntryRow[]) {
    const slot = slugToSlot(e.slot);
    const list = entriesBySlot.get(slot) ?? [];
    list.push(e);
    entriesBySlot.set(slot, list);
  }

  const meals = {} as DayData["meals"];
  for (const slot of MEAL_SLOTS) {
    meals[slot] = mealFromRows(slot, statusBySlot.get(slot)?.status, entriesBySlot.get(slot) ?? []);
  }
  const day: DayData = { meals };
  if (fasting.data) day.fasting = { start: fasting.data.start_time, end: fasting.data.end_time };
  if (workout.data) {
    day.workout = {
      performed: workout.data.performed,
      type: (workout.data.workout_type as WorkoutType | null) ?? undefined,
      feeling: (workout.data.feeling as WorkoutFeeling | null) ?? undefined,
    };
  }
  const stepRow = steps.data as DailyStepRow | null;
  day.steps = stepRow
    ? {
        goalSteps: stepRow.goal_steps,
        steps: stepRow.steps ?? undefined,
        completed: stepRow.completed,
      }
    : {
        goalSteps: latestGoal.data?.goal_steps ?? 10_000,
        completed: false,
      };
  return day;
}

export async function insertEntry(
  householdId: string,
  profileId: string,
  logDate: string,
  slot: MealSlotId,
  entry: Parameters<typeof entryToRow>[0],
): Promise<void> {
  const sb = requireSupabase();
  const row = entryToRow(entry, { householdId, profileId, logDate, slot });
  const { error } = await sb.from("food_entries").upsert(row);
  if (error) throw error;
  await setMealStatus(householdId, profileId, logDate, slot, "logged");
}

export async function deleteEntry(entryId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("food_entries").delete().eq("id", entryId);
  if (error) throw error;
}

export async function setMealStatus(
  householdId: string,
  profileId: string,
  logDate: string,
  slot: MealSlotId,
  status: Parameters<typeof statusToDb>[0],
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("meal_statuses").upsert(
    {
      household_id: householdId,
      profile_id: profileId,
      log_date: logDate,
      slot: slotToSlug(slot),
      status: statusToDb(status),
    },
    { onConflict: "profile_id,log_date,slot" },
  );
  if (error) throw error;
}

export async function upsertFasting(
  householdId: string,
  profileId: string,
  logDate: string,
  start: string,
  end: string,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("fasting_logs").upsert(
    {
      household_id: householdId,
      profile_id: profileId,
      log_date: logDate,
      start_time: start,
      end_time: end,
    },
    { onConflict: "profile_id,log_date" },
  );
  if (error) throw error;
}

/** Clears the fasting record for one profile/date (no-op when absent). */
export async function deleteFasting(profileId: string, logDate: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("fasting_logs")
    .delete()
    .eq("profile_id", profileId)
    .eq("log_date", logDate);
  if (error) throw error;
}

export async function upsertWorkout(
  householdId: string,
  profileId: string,
  logDate: string,
  workout: { performed: boolean | null; type?: string; feeling?: string },
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("workout_logs").upsert(
    {
      household_id: householdId,
      profile_id: profileId,
      log_date: logDate,
      performed: workout.performed,
      workout_type: workout.type ?? null,
      feeling: workout.feeling ?? null,
    },
    { onConflict: "profile_id,log_date" },
  );
  if (error) throw error;
}

/** Clears the workout record for one profile/date (no-op when absent). */
export async function deleteWorkout(profileId: string, logDate: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("workout_logs")
    .delete()
    .eq("profile_id", profileId)
    .eq("log_date", logDate);
  if (error) throw error;
}

export async function upsertDailySteps(
  householdId: string,
  profileId: string,
  logDate: string,
  steps: StepLog,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("daily_steps").upsert(
    {
      household_id: householdId,
      profile_id: profileId,
      log_date: logDate,
      goal_steps: steps.goalSteps,
      steps: steps.steps ?? null,
      completed: steps.completed,
    },
    { onConflict: "profile_id,log_date" },
  );
  if (error) throw error;
}

export async function loadWeighIns(profileId: string): Promise<WeighIn[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("weigh_ins")
    .select("*")
    .eq("profile_id", profileId)
    .order("measured_on");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    dateISO: r.measured_on,
    time: r.measured_at ?? undefined,
    weightKg: Number(r.weight_kg),
    bodyFatPct: r.body_fat_pct != null ? Number(r.body_fat_pct) : undefined,
  }));
}

export async function insertWeighIn(
  householdId: string,
  profileId: string,
  w: Omit<WeighIn, "id">,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("weigh_ins").insert({
    household_id: householdId,
    profile_id: profileId,
    measured_on: w.dateISO,
    measured_at: w.time ?? null,
    weight_kg: w.weightKg,
    body_fat_pct: w.bodyFatPct ?? null,
  });
  if (error) throw error;
}

/**
 * Idempotent weigh-in write keyed by the client-generated uuid: a retried
 * operation (offline → reconnect → replay) can never create a second row.
 */
export async function upsertWeighIn(
  householdId: string,
  profileId: string,
  w: WeighIn,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("weigh_ins").upsert(
    {
      id: w.id,
      household_id: householdId,
      profile_id: profileId,
      measured_on: w.dateISO,
      measured_at: w.time ?? null,
      weight_kg: w.weightKg,
      body_fat_pct: w.bodyFatPct ?? null,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

// --- custom foods -----------------------------------------------------------

/**
 * The household's catalog rows (seeded + custom). Archived rows are included on
 * purpose: `mergeCatalog` needs them to hide a built-in food the household
 * archived. Filtering happens there, not here.
 */
export async function loadFoods(
  householdId: string,
  localProfileById?: Map<string, ProfileId>,
): Promise<Food[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("foods")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as FoodRow[]).map((row) => foodFromRow(row, localProfileById));
}

/**
 * Whether the cloud `foods` table has `reference_group_key` (migration
 * 20260922090000). One cheap request on activation; a missing column answers
 * with SQLSTATE 42703, which is the only "no" — network errors stay unknown.
 */
export async function foodsSchemaSupportsReferenceLink(
  householdId: string,
): Promise<boolean | null> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("foods")
    .select("reference_group_key")
    .eq("household_id", householdId)
    .limit(1);
  if (!error) return true;
  if (error.code === "42703") return false;
  return null;
}

export async function upsertFood(
  householdId: string,
  food: Food,
  createdByProfileId: string | null = null,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("foods").upsert(foodToRow(food, householdId, createdByProfileId));
  if (error) throw error;
}

/** Soft-delete: keep the row so historical entries (stored by name) still read. */
export async function archiveFood(foodId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("foods").update({ is_active: false }).eq("id", foodId);
  if (error) throw error;
}

// --- favorites + recents (food_preferences) ---------------------------------

export async function loadPreferences(profileId: string): Promise<Preference[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("food_preferences").select("*").eq("profile_id", profileId);
  if (error) throw error;
  return ((data ?? []) as FoodPreferenceRow[]).map(preferenceFromRow);
}

/** Sets the favorite flag without touching recency. */
export async function setFavorite(
  householdId: string,
  profileId: string,
  foodId: string,
  isFavorite: boolean,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("food_preferences").upsert(
    {
      household_id: householdId,
      profile_id: profileId,
      food_id: foodId,
      is_favorite: isFavorite,
    },
    { onConflict: "profile_id,food_id" },
  );
  if (error) throw error;
}

/** Bumps recency (last_used_at) without touching the favorite flag. */
export async function bumpRecent(
  householdId: string,
  profileId: string,
  foodId: string,
  whenISO: string,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("food_preferences")
    .upsert(
      { household_id: householdId, profile_id: profileId, food_id: foodId, last_used_at: whenISO },
      { onConflict: "profile_id,food_id" },
    );
  if (error) throw error;
}

// --- dishes / estimated products / weight bridges (DEC-037) ------------------
// Household-wide entities: hydrated like `foods`, written through narrow,
// idempotent upserts keyed by the client-generated uuid.

/**
 * Whether the DEC-037 tables exist yet (migration 20260923090000). One cheap
 * request on activation; a missing relation answers with SQLSTATE 42P01, which
 * is the only definite "no" — network errors stay unknown (null).
 */
export async function dishesSchemaAvailable(householdId: string): Promise<boolean | null> {
  const sb = requireSupabase();
  const { error } = await sb.from("dishes").select("id").eq("household_id", householdId).limit(1);
  if (!error) return true;
  if (error.code === "42P01") return false;
  return null;
}

export async function loadEstimatedProducts(
  householdId: string,
  localProfileById?: Map<string, ProfileId>,
): Promise<EstimatedProduct[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("estimated_products")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as EstimatedProductRow[]).map((row) =>
    estimatedProductFromRow(row, localProfileById),
  );
}

export async function upsertEstimatedProduct(
  householdId: string,
  product: EstimatedProduct,
  createdByProfileId: string | null = null,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("estimated_products")
    .upsert(estimatedProductToRow(product, householdId, createdByProfileId), { onConflict: "id" });
  if (error) throw error;
}

export async function loadWeightBridges(
  householdId: string,
  localProfileById?: Map<string, ProfileId>,
): Promise<WeightBridge[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("weight_bridges")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as WeightBridgeRow[]).map((row) =>
    weightBridgeFromRow(row, localProfileById),
  );
}

export async function upsertWeightBridge(
  householdId: string,
  bridge: WeightBridge,
  createdByProfileId: string | null = null,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("weight_bridges")
    .upsert(weightBridgeToRow(bridge, householdId, createdByProfileId), {
      onConflict: "household_id,source_kind,source_key,unit",
    });
  if (error) throw error;
}

/** Dishes + the ingredient snapshot of each dish's current revision. */
export async function loadDishes(
  householdId: string,
  localProfileById?: Map<string, ProfileId>,
): Promise<Dish[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("dishes")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at");
  if (error) throw error;
  const rows = (data ?? []) as DishRow[];
  if (rows.length === 0) return [];
  const { data: versions, error: vErr } = await sb
    .from("dish_versions")
    .select("*")
    .eq("household_id", householdId)
    .in(
      "dish_id",
      rows.map((d) => d.id),
    );
  if (vErr) throw vErr;
  const current = new Map<string, DishVersionRow>();
  for (const v of (versions ?? []) as DishVersionRow[]) {
    const dish = rows.find((d) => d.id === v.dish_id);
    if (dish && dish.revision === v.revision) current.set(v.dish_id, v);
  }
  return rows.map((row) => dishFromRows(row, current.get(row.id), localProfileById));
}

/**
 * Writes the dish's current definition AND the immutable snapshot of that
 * revision. Both are idempotent: the dish upserts on its id, the version on
 * (dish_id, revision), so a queue replay cannot duplicate either.
 */
export async function upsertDish(
  householdId: string,
  dish: Dish,
  createdByProfileId: string | null = null,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("dishes")
    .upsert(dishToRow(dish, householdId, createdByProfileId), { onConflict: "id" });
  if (error) throw error;
  const { error: vErr } = await sb
    .from("dish_versions")
    .upsert(dishVersionToRow(dish, householdId, createdByProfileId), {
      onConflict: "dish_id,revision",
    });
  if (vErr) throw vErr;
}

/** Soft archive: the dish leaves the active list, its history stays readable. */
export async function archiveDish(dishId: string, isActive: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("dishes").update({ is_active: isActive }).eq("id", dishId);
  if (error) throw error;
}
