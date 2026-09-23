import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { GoalMode, SexAtBirth } from "@/lib/points";
import { ageFromBirthDate, formatPoints, latestWeightKg } from "@/lib/points";
import { BUDGET_V2 } from "@/lib/points-config";
import { cn } from "@/lib/utils";

/**
 * The daily target (DEC-037). The manually entered per-profile target is the
 * ONLY source of the active budget: there is no automatic/BMR value any more,
 * and no fallback when it is empty — "יעד לא הוגדר" is a real state.
 *
 * Sex / birth date / height / goal are still stored (they are the seam for a
 * future lookup table) but they are secondary here and the sheet says plainly
 * that they do not affect the target today. Weight is never typed here.
 */
export function PointsBudgetEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const facts = store.profileFacts;
  const info = store.getPointsBudgetInfo(store.activeProfile);
  const weight = latestWeightKg(store.weighIns);

  const [target, setTarget] = useState(
    facts.pointsBudgetOverride != null ? String(facts.pointsBudgetOverride) : "",
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sex, setSex] = useState<SexAtBirth | "">(facts.sexAtBirth ?? "");
  const [birthDate, setBirthDate] = useState(facts.birthDate ?? "");
  const [height, setHeight] = useState(facts.heightCm != null ? String(facts.heightCm) : "");
  const [goal, setGoal] = useState<GoalMode>(facts.goalMode ?? "lose");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTarget(facts.pointsBudgetOverride != null ? String(facts.pointsBudgetOverride) : "");
    setSex(facts.sexAtBirth ?? "");
    setBirthDate(facts.birthDate ?? "");
    setHeight(facts.heightCm != null ? String(facts.heightCm) : "");
    setGoal(facts.goalMode ?? "lose");
    setDetailsOpen(false);
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
    const targetNum = target.trim() === "" ? null : Number(target);
    if (
      targetNum != null &&
      (!Number.isInteger(targetNum) ||
        targetNum < BUDGET_V2.OVERRIDE_MIN ||
        targetNum > BUDGET_V2.OVERRIDE_MAX)
    ) {
      setError(`יעד יומי: מספר שלם בין ${BUDGET_V2.OVERRIDE_MIN} ל־${BUDGET_V2.OVERRIDE_MAX}.`);
      return;
    }
    store.setProfileFacts({
      pointsBudgetOverride: targetNum,
      sexAtBirth: sex === "" ? null : sex,
      birthDate: birthDate || null,
      heightCm: heightNum,
      goalMode: goal,
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
              היעד נקבע ידנית בלבד. בלי יעד האפליקציה לא ממציאה מספר — פשוט אין השוואה.
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
          {info.budget == null ? (
            <strong data-testid="budget-none">לא הוגדר</strong>
          ) : (
            <>
              <strong className="tabular-nums">{formatPoints(info.budget)} נק׳</strong>
              <span className="mr-2 text-xs text-muted-foreground">· יעד ידני</span>
            </>
          )}
        </div>

        <label htmlFor="points-budget" className="mb-1 block text-sm font-medium">
          יעד יומי (נקודות)
        </label>
        <div className="flex gap-2">
          <input
            id="points-budget"
            type="number"
            inputMode="numeric"
            min={BUDGET_V2.OVERRIDE_MIN}
            max={BUDGET_V2.OVERRIDE_MAX}
            step="1"
            value={target}
            placeholder="לדוגמה 27"
            onChange={(e) => {
              setTarget(e.target.value);
              setError(null);
            }}
            className={field}
          />
          {target !== "" && (
            <button
              type="button"
              onClick={() => setTarget("")}
              className="min-h-11 shrink-0 rounded-xl border border-border bg-card px-3 text-sm font-medium"
            >
              ניקוי
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Body facts stay available but are explicitly NOT the target source. */}
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          data-testid="profile-facts-toggle"
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-right text-sm font-medium"
        >
          <span>
            פרטים אישיים
            <span className="mr-2 text-[11px] font-normal text-muted-foreground">
              לא משפיעים על היעד כרגע
            </span>
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")}
            aria-hidden
          />
        </button>

        {detailsOpen && (
          <div className="mt-3" data-testid="profile-facts">
            {weight != null && (
              <p className="mb-3 text-xs text-muted-foreground" dir="rtl">
                משקל אחרון {weight} ק״ג
                {facts.birthDate ? ` · גיל ${ageFromBirthDate(facts.birthDate)}` : ""}
              </p>
            )}
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

            <fieldset>
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
          </div>
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
