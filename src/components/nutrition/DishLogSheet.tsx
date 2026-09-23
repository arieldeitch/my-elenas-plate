import { useState } from "react";
import { Info, X } from "lucide-react";
import type { Dish, MealSlotId, WeightSource } from "@/lib/domain";
import { MEAL_SLOTS } from "@/lib/domain";
import { MEAL_LABELS } from "@/lib/meal-slots";
import { useStore } from "@/lib/store";
import { parseAmount } from "@/lib/quantity";
import { formatPoints } from "@/lib/points";
import { dishServingPoints, formatPointsPerGram } from "@/lib/dishes";
import { ESTIMATED_SHORT } from "@/lib/label-estimator";
import { cn } from "@/lib/utils";

interface Props {
  dish: Dish | null;
  /** When set, the serving goes straight into this slot (opened from a meal). */
  slot?: MealSlotId;
  onClose: () => void;
  onLogged?: () => void;
}

/**
 * Logging a served weight of a dish (DEC-037 R8). The weight is either weighed
 * or estimated by the person — the two are stored distinguishably, and the
 * saved entry keeps the dish revision it was logged from.
 */
export function DishLogSheet({ dish, slot, onClose, onLogged }: Props) {
  const store = useStore();
  const [grams, setGrams] = useState(
    dish?.usualServingWeightG != null ? String(dish.usualServingWeightG) : "",
  );
  const [weightSource, setWeightSource] = useState<WeightSource>("weighed");
  const [target, setTarget] = useState<MealSlotId>(slot ?? "lunch");
  const [error, setError] = useState<string | null>(null);

  if (!dish) return null;

  const parsed = parseAmount(grams);
  const preview = Number.isFinite(parsed) ? dishServingPoints(dish.pointsPerGram, parsed) : 0;

  function log() {
    const value = parseAmount(grams);
    if (!Number.isFinite(value) || value <= 0) return setError("יש להזין משקל מנה בגרמים.");
    const entry = store.logDish(target, {
      dishId: dish!.id,
      grams: value,
      weightSource,
    });
    if (!entry) return setError("לא ניתן לרשום את המנה.");
    onLogged?.();
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`רישום מנה: ${dish.name}`}
      data-testid="dish-log-sheet"
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
            <h2 className="font-bold text-foreground">
              {dish.name}
              {dish.hasEstimatedIngredient && (
                <span className="mr-2 rounded-full bg-info-soft px-1.5 py-0.5 text-[10px] font-semibold text-info">
                  {ESTIMATED_SHORT}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {formatPointsPerGram(dish.pointsPerGram)} · גרסה {dish.revision}
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

        {!slot && (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium" htmlFor="dish-slot">
              לאיזו ארוחה
            </label>
            <select
              id="dish-slot"
              value={target}
              onChange={(e) => setTarget(e.target.value as MealSlotId)}
              className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            >
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {MEAL_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="mb-1 block text-sm font-medium" htmlFor="dish-grams">
          כמה גרם אכלתי
        </label>
        <input
          id="dish-grams"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={grams}
          onChange={(e) => {
            setGrams(e.target.value);
            setError(null);
          }}
          className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        {dish.usualServingWeightG != null && (
          <button
            type="button"
            data-testid="dish-usual-serving"
            onClick={() => setGrams(String(dish.usualServingWeightG))}
            className="mt-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium"
          >
            מנה רגילה · {dish.usualServingWeightG} גרם
          </button>
        )}

        <div className="mt-3">
          <div className="mb-1 text-sm font-medium">המשקל</div>
          <div
            role="radiogroup"
            aria-label="מקור המשקל"
            className="inline-flex w-full rounded-full border border-border bg-secondary p-1"
          >
            {(
              [
                ["weighed", "נשקל"],
                ["estimated", "הערכה"],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={weightSource === value}
                data-testid={`dish-weight-${value}`}
                onClick={() => setWeightSource(value)}
                className={cn(
                  "min-h-10 flex-1 rounded-full px-3 text-sm font-semibold",
                  weightSource === value
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground",
                )}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <div
          className="mt-3 rounded-xl border border-border bg-secondary/55 px-3 py-2 text-sm text-muted-foreground"
          data-testid="dish-log-preview"
          data-points={preview}
          aria-live="polite"
        >
          יתווספו: <strong className="text-foreground">{formatPoints(preview)} נק׳</strong>
          <span className="block text-[11px]">
            {weightSource === "estimated" ? "משקל בהערכה" : "משקל שנשקל"}
            {dish.hasEstimatedIngredient ? " · התבשיל כולל מרכיב בהערכה" : ""}
          </span>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={log}
          data-testid="dish-log-confirm"
          className="mt-4 min-h-12 w-full rounded-2xl bg-primary px-4 font-semibold text-primary-foreground"
        >
          רישום לארוחה
        </button>

        {dish.ingredients.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">מה יש בתבשיל</summary>
            <ul className="mt-2 space-y-1" data-testid="dish-log-ingredients">
              {dish.ingredients.map((ing, i) => (
                <li key={`${ing.name}-${i}`} className="text-[11px] text-muted-foreground">
                  {ing.name} · {ing.amount} {ing.unit} · {formatPoints(ing.points)} נק׳
                  {ing.sourceKind === "estimated" && (
                    <span className="mr-1 text-info">({ESTIMATED_SHORT})</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Info className="h-3 w-3" aria-hidden />
              הרישום נשמר עם הגרסה הנוכחית; עריכה עתידית של התבשיל לא תשנה אותו.
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
