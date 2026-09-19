import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { GoalMode, SexAtBirth } from "@/lib/points";
import { ageFromBirthDate, formatPoints, latestWeightKg } from "@/lib/points";
import { BUDGET_V2 } from "@/lib/points-config";
import { cn } from "@/lib/utils";

/**
 * Profile setup for the personalised daily budget (DEC-034): sex at birth,
 * birth date, height, goal mode — plus an explicit manual override. Weight is
 * never typed here; it comes from the person's latest weigh-in. Only the active
 * person's facts are edited (the partner card never opens this sheet).
 */
export function PointsBudgetEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const facts = store.profileFacts;
  const info = store.getPointsBudgetInfo(store.activeProfile);
  const weight = latestWeightKg(store.weighIns);

  const [sex, setSex] = useState<SexAtBirth | "">(facts.sexAtBirth ?? "");
  const [birthDate, setBirthDate] = useState(facts.birthDate ?? "");
  const [height, setHeight] = useState(facts.heightCm != null ? String(facts.heightCm) : "");
  const [goal, setGoal] = useState<GoalMode>(facts.goalMode ?? "lose");
  const [override, setOverride] = useState(
    facts.pointsBudgetOverride != null ? String(facts.pointsBudgetOverride) : "",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSex(facts.sexAtBirth ?? "");
    setBirthDate(facts.birthDate ?? "");
    setHeight(facts.heightCm != null ? String(facts.heightCm) : "");
    setGoal(facts.goalMode ?? "lose");
    setOverride(facts.pointsBudgetOverride != null ? String(facts.pointsBudgetOverride) : "");
    setError(null);
    // Reset the form only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function save() {
    const heightNum = height.trim() === "" ? null : Number(height);
    if (heightNum != null && (!Number.isFinite(heightNum) || heightNum <= 50 || heightNum >= 260)) {
      setError("גובה בסנטימטרים, בין 50 ל־260.");
      return;
    }
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setError("תאריך לידה לא תקין.");
      return;
    }
    const overrideNum = override.trim() === "" ? null : Number(override);
    if (
      overrideNum != null &&
      (!Number.isInteger(overrideNum) ||
        overrideNum < BUDGET_V2.OVERRIDE_MIN ||
        overrideNum > BUDGET_V2.OVERRIDE_MAX)
    ) {
      setError(`יעד ידני: מספר שלם בין ${BUDGET_V2.OVERRIDE_MIN} ל־${BUDGET_V2.OVERRIDE_MAX}.`);
      return;
    }
    store.setProfileFacts({
      sexAtBirth: sex === "" ? null : sex,
      birthDate: birthDate || null,
      heightCm: heightNum,
      goalMode: goal,
      pointsBudgetOverride: overrideNum,
    });
    onClose();
  }

  const field =
    "w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring";
  const seg = (active: boolean) =>
    cn(
      "min-h-10 flex-1 rounded-full px-3 text-sm font-semibold",
      active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="יעד נקודות יומי"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        aria-label="סגירה"
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="keyboard-safe-sheet relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-lg sm:rounded-3xl">
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-foreground">יעד נקודות יומי</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              היעד מחושב מהגוף (מין, גיל, גובה, המשקל האחרון שנשקל) ומהמטרה. מודל פנימי ושקוף; לא
              הנוסחה של שומרי משקל.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="mb-4 rounded-xl border border-border bg-secondary/55 px-3 py-2 text-sm"
          data-testid="budget-summary"
          data-source={info.source}
        >
          <span className="text-muted-foreground">יעד נוכחי: </span>
          <strong className="tabular-nums">{formatPoints(info.budget)} נק׳</strong>
          <span className="mr-2 text-xs text-muted-foreground">
            {info.source === "override"
              ? "· יעד מותאם אישית"
              : info.source === "personalized"
                ? "· יעד אוטומטי"
                : "· יעד זמני עד השלמת הפרטים"}
          </span>
          {weight != null && facts.birthDate && (
            <div className="mt-1 text-xs text-muted-foreground" dir="rtl">
              משקל אחרון {weight} ק״ג · גיל {ageFromBirthDate(facts.birthDate)}
            </div>
          )}
          {weight == null && (
            <div className="mt-1 text-xs text-muted-foreground">
              אין עדיין שקילה — המשקל נלקח מהשקילה האחרונה.
            </div>
          )}
        </div>

        <fieldset className="mb-3">
          <legend className="mb-1 text-sm font-medium">מין בלידה</legend>
          <div
            role="radiogroup"
            aria-label="מין בלידה"
            className="inline-flex w-full rounded-full border border-border bg-secondary p-1"
          >
            {(
              [
                ["female", "נקבה"],
                ["male", "זכר"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={sex === value}
                onClick={() => setSex(value)}
                className={seg(sex === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label htmlFor="birth-date" className="mb-1 block text-sm font-medium">
          תאריך לידה
        </label>
        <input
          id="birth-date"
          type="date"
          value={birthDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => {
            setBirthDate(e.target.value);
            setError(null);
          }}
          className={cn(field, "mb-3")}
          dir="ltr"
        />

        <label htmlFor="height-cm" className="mb-1 block text-sm font-medium">
          גובה (ס״מ)
        </label>
        <input
          id="height-cm"
          type="number"
          inputMode="numeric"
          min="50"
          max="260"
          step="1"
          value={height}
          onChange={(e) => {
            setHeight(e.target.value);
            setError(null);
          }}
          className={cn(field, "mb-3")}
        />

        <fieldset className="mb-3">
          <legend className="mb-1 text-sm font-medium">מטרה</legend>
          <div
            role="radiogroup"
            aria-label="מטרה"
            className="inline-flex w-full rounded-full border border-border bg-secondary p-1"
          >
            {(
              [
                ["lose", "ירידה במשקל"],
                ["maintain", "שמירה על המשקל"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={goal === value}
                onClick={() => setGoal(value)}
                className={seg(goal === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label htmlFor="points-budget" className="mb-1 block text-sm font-medium">
          יעד ידני (לא חובה)
        </label>
        <div className="flex gap-2">
          <input
            id="points-budget"
            type="number"
            inputMode="numeric"
            min={BUDGET_V2.OVERRIDE_MIN}
            max={BUDGET_V2.OVERRIDE_MAX}
            step="1"
            value={override}
            placeholder="אוטומטי"
            onChange={(e) => {
              setOverride(e.target.value);
              setError(null);
            }}
            className={field}
          />
          {override !== "" && (
            <button
              type="button"
              onClick={() => setOverride("")}
              className="min-h-11 shrink-0 rounded-xl border border-border bg-card px-3 text-sm font-medium"
            >
              חזרה ליעד אוטומטי
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={save}
          className="mt-4 min-h-12 w-full rounded-2xl bg-primary px-4 font-semibold text-primary-foreground"
        >
          שמירה
        </button>
      </div>
    </div>
  );
}
