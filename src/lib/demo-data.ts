import type {
  DailyMeal,
  DayData,
  FoodEntry,
  MealSlotId,
  ProfileId,
  SubjectiveAmount,
  Unit,
  WeighIn,
} from "./domain";
import { MEAL_SLOTS } from "./domain";
import { toISODate, addDays } from "./format";

let idCounter = 1;
const nid = (p = "e") => `${p}_${idCounter++}`;

function emptyDay(): DayData {
  const meals = {} as Record<MealSlotId, DailyMeal>;
  for (const s of MEAL_SLOTS) meals[s] = { slot: s, status: "empty", entries: [] };
  return { meals };
}

function measured(foodId: string, foodName: string, amount: number, unit: Unit): FoodEntry {
  return { id: nid(), foodId, foodName, mode: "measured", amount, unit };
}
function subj(foodId: string, foodName: string, s: SubjectiveAmount): FoodEntry {
  return { id: nid(), foodId, foodName, mode: "subjective", subjective: s };
}

const today = new Date();
const TODAY = toISODate(today);

// Build today's data for both profiles
function meDay(): DayData {
  const d = emptyDay();
  d.meals.breakfast = {
    slot: "breakfast",
    status: "logged",
    entries: [
      measured("f_omelette", "חביתה", 2, "יחידה"),
      subj("f_veg_salad", "סלט ירקות", "במידה"),
      measured("f_whole_bread", "לחם מלא", 2, "פרוסה"),
    ],
  };
  d.meals.morning_snack = {
    slot: "morning_snack",
    status: "logged",
    entries: [
      {
        ...measured("f_coffee", "קפה", 1, "כוס"),
        coffee: { type: "אמריקנו", milk: "עם חלב", milkType: "שקדים" },
      },
    ],
  };
  d.meals.afternoon_snack = {
    slot: "afternoon_snack",
    status: "logged",
    entries: [
      {
        ...measured("f_coffee", "קפה", 1, "ספל"),
        coffee: { type: "קפוצ׳ינו", milk: "עם חלב", milkType: "חלב דל שומן" },
      },
    ],
  };
  d.meals.lunch = {
    slot: "lunch",
    status: "logged",
    entries: [
      measured("f_chicken_breast", "חזה עוף", 180, "גרם"),
      measured("f_rice", "אורז", 1, "כוס"),
      measured("f_tahini", "טחינה", 1, "כף"),
    ],
  };
  d.meals.late = { slot: "late", status: "skipped", entries: [] };
  d.fasting = { start: "20:30", end: "12:30" };
  d.workout = { performed: true, type: "הליכה", feeling: "טוב" };
  return d;
}

function elenaDay(): DayData {
  const d = emptyDay();
  d.meals.breakfast = {
    slot: "breakfast",
    status: "logged",
    entries: [
      measured("f_yogurt", "יוגורט", 1, "יחידה"),
      measured("f_granola", "גרנולה", 3, "כף"),
      measured("f_banana", "בננה", 1, "יחידה"),
    ],
  };
  d.meals.morning_snack = { slot: "morning_snack", status: "skipped", entries: [] };
  d.meals.lunch = {
    slot: "lunch",
    status: "logged",
    entries: [
      subj("f_veg_salad", "סלט ירקות", "הרבה"),
      measured("f_white_cheese", "גבינה לבנה", 100, "גרם"),
    ],
  };
  d.meals.afternoon_snack = {
    slot: "afternoon_snack",
    status: "logged",
    entries: [measured("f_apple", "תפוח", 1, "יחידה"), subj("f_almonds", "שקדים", "מעט")],
  };
  d.workout = { performed: null };
  return d;
}

function fullSampleDay(): DayData {
  const d = emptyDay();
  for (const s of MEAL_SLOTS) {
    d.meals[s] = {
      slot: s,
      status: "logged",
      entries: [measured("f_apple", "תפוח", 1, "יחידה")],
    };
  }
  d.meals.late = { slot: "late", status: "skipped", entries: [] };
  return d;
}

function partialSampleDay(): DayData {
  const d = emptyDay();
  d.meals.breakfast = {
    slot: "breakfast",
    status: "logged",
    entries: [measured("f_coffee", "קפה", 1, "כוס")],
  };
  d.meals.lunch = {
    slot: "lunch",
    status: "logged",
    entries: [subj("f_veg_salad", "סלט ירקות", "במידה")],
  };
  d.meals.dinner = { slot: "dinner", status: "skipped", entries: [] };
  return d;
}

export function initialDays(profile: ProfileId): Record<string, DayData> {
  const map: Record<string, DayData> = {};
  map[TODAY] = profile === "me" ? meDay() : elenaDay();
  // seed sample days across the current month
  const seeds: Array<{ offset: number; kind: "full" | "partial" | "empty" }> = [
    { offset: -1, kind: "full" },
    { offset: -2, kind: "partial" },
    { offset: -3, kind: "full" },
    { offset: -4, kind: "empty" },
    { offset: -5, kind: "partial" },
    { offset: -7, kind: "full" },
    { offset: -8, kind: "partial" },
    { offset: -10, kind: "full" },
    { offset: -12, kind: "partial" },
    { offset: -14, kind: "full" },
  ];
  // Elena has slightly different pattern
  const shift = profile === "me" ? 0 : 1;
  for (const { offset, kind } of seeds) {
    const iso = toISODate(addDays(today, offset - shift));
    if (kind === "full") map[iso] = fullSampleDay();
    else if (kind === "partial") map[iso] = partialSampleDay();
    // empty -> omit
  }
  return map;
}

export function initialWeighIns(profile: ProfileId): WeighIn[] {
  if (profile === "me") {
    return [
      { id: nid("w"), dateISO: toISODate(addDays(today, -7)), weightKg: 83.0, bodyFatPct: 24.6 },
      { id: nid("w"), dateISO: TODAY, weightKg: 82.4, bodyFatPct: 24.1 },
    ];
  }
  return [{ id: nid("w"), dateISO: TODAY, weightKg: 64.8 }];
}

export function initialFavorites(profile: ProfileId): string[] {
  if (profile === "me") return ["f_coffee", "f_omelette", "f_chicken_breast", "f_tahini"];
  return ["f_yogurt", "f_apple", "f_veg_salad", "f_granola"];
}

export function initialRecents(profile: ProfileId): string[] {
  if (profile === "me") return ["f_whole_bread", "f_veg_salad", "f_rice", "f_milk", "f_coffee"];
  return ["f_banana", "f_almonds", "f_white_cheese", "f_apple"];
}
