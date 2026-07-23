export type ProfileId = "me" | "elena";

export interface Profile {
  id: ProfileId;
  name: string;
  initials: string;
}

export type MealSlotId =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "afternoon_snack"
  | "dinner"
  | "late";

export const MEAL_SLOTS: MealSlotId[] = [
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "dinner",
  "late",
];

export type MealStatus = "empty" | "logged" | "skipped";

export type QuantityMode = "measured" | "subjective";
export type SubjectiveAmount = "מעט" | "במידה" | "הרבה" | "מוגזם";

export type Unit =
  | "גרם"
  | "ק״ג"
  | "מ״ל"
  | "ליטר"
  | "יחידה"
  | "חצי יחידה"
  | "כף"
  | "כפית"
  | "כוס"
  | "פרוסה"
  | "קערה"
  | "מנה";

export const ALL_UNITS: Unit[] = [
  "גרם",
  "ק״ג",
  "מ״ל",
  "ליטר",
  "יחידה",
  "חצי יחידה",
  "כף",
  "כפית",
  "כוס",
  "פרוסה",
  "קערה",
  "מנה",
];

export interface Food {
  id: string;
  name: string;
  category?: string;
  defaultUnit?: Unit;
  suggestedUnits?: Unit[];
}

export interface FoodEntry {
  id: string;
  foodId: string;
  foodName: string;
  mode: QuantityMode;
  amount?: number;
  unit?: Unit;
  subjective?: SubjectiveAmount;
}

export interface DailyMeal {
  slot: MealSlotId;
  status: MealStatus;
  entries: FoodEntry[];
}

export interface FastingLog {
  start: string; // HH:mm
  end: string; // HH:mm
}

export type WorkoutType =
  | "כוח"
  | "אירובי"
  | "הליכה"
  | "ריצה"
  | "אופניים"
  | "שחייה"
  | "יוגה / גמישות"
  | "ספורט קבוצתי"
  | "אחר";

export type WorkoutFeeling = "קל" | "טוב" | "מאתגר" | "קשה" | "אחר";

export interface WorkoutLog {
  performed: boolean | null; // null = not documented
  type?: WorkoutType;
  feeling?: WorkoutFeeling;
}

export interface WeighIn {
  id: string;
  dateISO: string; // yyyy-mm-dd
  time?: string; // HH:mm
  weightKg: number;
  bodyFatPct?: number;
}

export interface DayData {
  meals: Record<MealSlotId, DailyMeal>;
  fasting?: FastingLog;
  workout?: WorkoutLog;
}

export type SyncState = "saved" | "saving" | "offline" | "pending" | "error";
