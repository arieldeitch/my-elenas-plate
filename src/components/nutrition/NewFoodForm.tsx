import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import type { Unit } from "@/lib/domain";
import { ALL_UNITS } from "@/lib/domain";
import { parseAmount } from "@/lib/quantity";
import { formatPoints } from "@/lib/points";
import {
  formatPortion,
  getReferenceIndex,
  REFERENCE_CATEGORIES,
  suggestSimilar,
  type Confidence,
} from "@/lib/points-reference";
import type { NewFoodDetails } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Props {
  initialName: string;
  onSubmit: (input: { name: string; category: string; details: NewFoodDetails }) => void;
  onCancel: () => void;
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "ודאות גבוהה",
  medium: "ודאות בינונית",
  low: "ודאות נמוכה",
};

const PORTION_UNITS: Unit[] = ["יחידה", "גרם", "מ״ל", "כף", "כפית", "כוס", "פרוסה", "מנה"];

/**
 * A food the reference does not know (DEC-035 §7): name, reference quantity,
 * unit, category and points are entered explicitly. The points field may be
 * pre-filled from a similar reference row, shown as "הצעה לבדיקה" with its
 * source and confidence — never a category average, never a guess — and the
 * person must confirm before the food is saved for reuse.
 */
export function NewFoodForm({ initialName, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initialName);
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<Unit>("יחידה");
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [points, setPoints] = useState<string>("");
  const [suggestionSource, setSuggestionSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const index = getReferenceIndex();
  const suggestions = useMemo(() => suggestSimilar(index.itemsById.values(), name), [index, name]);

  function handleSubmit() {
    const trimmed = name.trim();
    const n = parseAmount(amount);
    const p = parseAmount(points);
    if (!trimmed) return setError("יש להזין שם למאכל");
    if (!Number.isFinite(n) || n <= 0) return setError("יש להזין כמות ייחוס חיובית");
    if (!category) return setError("יש לבחור קטגוריה");
    // An empty field must not pass as 0: zero is a deliberate value, not a default.
    if (points.trim() === "" || !Number.isFinite(p) || p < 0) {
      return setError("יש להזין ניקוד (אפשר 0 או חצאי נקודה)");
    }
    if (Math.abs(p * 2 - Math.round(p * 2)) > 1e-9) return setError("הניקוד נרשם בחצאי נקודות");
    onSubmit({
      name: trimmed,
      category,
      details: {
        portionAmount: n,
        portionUnit: unit,
        pointsPerPortion: p,
        pointsStatus: "confirmed",
      },
    });
  }

  const unitList = showAllUnits ? ALL_UNITS : PORTION_UNITS;

  return (
    <div className="flex flex-col gap-4" data-testid="new-food-form">
      <div className="rounded-2xl bg-secondary/60 px-3 py-2">
        <div className="text-xs text-muted-foreground">מאכל חדש — לא נמצא במאגר</div>
        <div className="text-[11px] text-muted-foreground">
          הניקוד נשמר רק אחרי אישור, ומשמש לכל פעם הבאה.
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="nf-name">
          שם המאכל
        </label>
        <input
          id="nf-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-[96px_1fr] gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="nf-amount">
            כמות ייחוס
          </label>
          <input
            id="nf-amount"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">יחידה</div>
          <div className="flex flex-wrap gap-1.5">
            {unitList.map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                data-testid="nf-unit"
                onClick={() => setUnit(u)}
                className={cn(
                  "rounded-full border px-2.5 py-1.5 text-sm",
                  unit === u
                    ? "border-primary bg-primary-soft text-primary font-medium"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                {u}
              </button>
            ))}
            {!showAllUnits && (
              <button
                type="button"
                onClick={() => setShowAllUnits(true)}
                className="rounded-full border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground"
              >
                עוד
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="nf-category">
          קטגוריה
        </label>
        <select
          id="nf-category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setError(null);
          }}
          className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">בחירת קטגוריה</option>
          {REFERENCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="nf-points">
          נקודות לכמות הייחוס
        </label>
        <input
          id="nf-points"
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          value={points}
          placeholder="למשל 2 או 2.5"
          onChange={(e) => {
            setPoints(e.target.value);
            setSuggestionSource(null);
            setError(null);
          }}
          className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        {suggestionSource && (
          <div
            className="mt-1 text-[11px] text-muted-foreground"
            data-testid="nf-suggestion-source"
          >
            הצעה לבדיקה על בסיס: {suggestionSource}. יש לאשר לפני השמירה.
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-2">
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" />
            הצעות לבדיקה — מאכלים דומים במאגר
          </div>
          <div className="space-y-1">
            {suggestions.map((s) => (
              <button
                key={s.item.id}
                type="button"
                data-testid="nf-suggestion"
                data-confidence={s.confidence}
                onClick={() => {
                  setPoints(String(s.item.points));
                  setSuggestionSource(
                    `${s.item.displayName} · ${formatPortion(s.item.portion)} · ${CONFIDENCE_LABEL[s.confidence]}`,
                  );
                  if (s.item.category && !category) setCategory(s.item.category);
                  setError(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg bg-card px-2 py-2 text-right text-sm hover:border-primary/40"
              >
                <span className="min-w-0 flex-1 truncate">{s.item.displayName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatPortion(s.item.portion)} · {formatPoints(s.item.points)} נק׳ ·{" "}
                  {CONFIDENCE_LABEL[s.confidence]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          data-testid="nf-confirm"
          className="flex-1 rounded-2xl bg-primary py-3 text-primary-foreground font-semibold hover:bg-primary/90"
        >
          אישור הניקוד ושמירה
        </button>
        <button
          onClick={onCancel}
          className="rounded-2xl border border-border bg-card px-4 py-3 font-medium hover:bg-muted"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
