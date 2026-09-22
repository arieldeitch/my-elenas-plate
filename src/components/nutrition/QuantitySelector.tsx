import { useMemo, useState } from "react";
import type { Food, FoodEntry, QuantityMode, SubjectiveAmount, Unit } from "@/lib/domain";
import { ALL_UNITS } from "@/lib/domain";
import { parseAmount, validateMeasured } from "@/lib/quantity";
import { formatPoints, scoreDetails, SUBJECTIVE_LABEL } from "@/lib/points";
import {
  BLOCK_MESSAGES,
  formatPortion,
  getReferenceIndex,
  groupForFood,
  portionAsQuantity,
  resolvableUnits,
  resolveReferenceItem,
  type ReferenceRuntimeItem as ReferenceItem,
} from "@/lib/points-reference";
import { cn } from "@/lib/utils";

interface Props {
  food: Food;
  initial?: FoodEntry;
  /** The chosen reference variation (DEC-035); derived from the food when it has exactly one. */
  referenceItem?: ReferenceItem;
  onSubmit: (entry: Omit<FoodEntry, "id">) => void;
  onCancel: () => void;
  submitLabel?: string;
}

const SUBJECTIVES: SubjectiveAmount[] = ["מעט", "במידה", "הרבה", "מוגזם"];

const BASIS_LABEL: Record<string, string> = {
  "reference:exact": "לפי המאגר · מנת ייחוס",
  "reference:scaled": "לפי המאגר · חישוב יחסי",
  "reference:any": "לפי המאגר · 0 בכל כמות",
  "custom:confirmed": "לפי הערך שאושר למאכל",
  "model:v2-il": "הערכה לפי המודל הפנימי",
};

export function QuantitySelector({
  food,
  initial,
  referenceItem,
  onSubmit,
  onCancel,
  submitLabel = "הוספת המאכל",
}: Props) {
  const index = getReferenceIndex();
  // The reference row this quantity is scored against: the explicit choice,
  // the row of the entry being edited, or the single row of the linked group.
  const item = useMemo(() => {
    if (referenceItem) return referenceItem;
    if (initial?.referenceItemId) return index.itemsById.get(initial.referenceItemId);
    const group = groupForFood(index, food);
    return group?.items.length === 1 ? group.items[0] : undefined;
  }, [referenceItem, initial?.referenceItemId, food, index]);
  const portionQuantity = item ? portionAsQuantity(item.portion) : null;

  const [mode, setMode] = useState<QuantityMode>(initial?.mode ?? "measured");
  const [amount, setAmount] = useState<string>(
    initial?.amount != null ? String(initial.amount) : String(portionQuantity?.amount ?? 1),
  );
  const [unit, setUnit] = useState<Unit>(
    (initial?.unit ?? portionQuantity?.unit ?? food.defaultUnit ?? "יחידה") as Unit,
  );
  const [subjective, setSubjective] = useState<SubjectiveAmount>(initial?.subjective ?? "במידה");
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A reference portion offers only the units the engine can resolve safely;
  // "יחידות נוספות" still exists so the person can see why a unit is refused.
  const suggested = item
    ? resolvableUnits(item.portion)
    : (food.suggestedUnits ?? [food.defaultUnit ?? "יחידה"]);
  const unitList = showAllUnits ? ALL_UNITS : suggested.length > 0 ? suggested : ALL_UNITS;
  const parsedPreviewAmount = parseAmount(amount);
  const quantity =
    mode === "measured"
      ? ({ mode: "measured", amount: parsedPreviewAmount || 0, unit } as const)
      : ({ mode: "subjective", subjective } as const);
  const preview = scoreDetails(
    { ...quantity, referenceItemId: item?.id, coffee: undefined },
    food,
    { reference: index },
  );
  const resolution = item ? resolveReferenceItem(item, quantity) : null;
  const blockedMessage =
    preview.pointsBasis === "reference:blocked"
      ? resolution?.reason
        ? BLOCK_MESSAGES[resolution.reason]
        : BLOCK_MESSAGES.no_portion
      : preview.pointsBasis === "custom:blocked"
        ? BLOCK_MESSAGES.count_unit_mismatch
        : null;

  function handleSubmit() {
    if (blockedMessage) {
      setError(blockedMessage);
      return;
    }
    const base = { foodId: food.id, foodName: food.name, referenceItemId: item?.id };
    if (mode === "measured") {
      const n = parseAmount(amount);
      const errs = validateMeasured({ amount: n, unit });
      if (errs.includes("amount")) {
        setError("יש להזין כמות חיובית");
        return;
      }
      if (errs.includes("unit")) {
        setError("יש לבחור יחידה");
        return;
      }
      onSubmit({ ...base, mode: "measured", amount: n, unit });
    } else {
      onSubmit({ ...base, mode: "subjective", subjective });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-secondary/60 px-3 py-2">
        <div className="text-xs text-muted-foreground">נבחר</div>
        <div className="font-semibold text-foreground">{food.name}</div>
        {item && (
          <div className="mt-0.5 text-xs text-muted-foreground" data-testid="reference-line">
            מנת ייחוס: {formatPortion(item.portion)} = {formatPoints(item.points)} נק׳
            {item.category ? ` · ${item.category}` : ""}
          </div>
        )}
        {!item && food.pointsStatus === "confirmed" && food.pointsPerPortion != null && (
          <div className="mt-0.5 text-xs text-muted-foreground" data-testid="reference-line">
            ערך שאושר: {food.portionAmount ?? 1} {food.portionUnit ?? food.defaultUnit} ={" "}
            {formatPoints(food.pointsPerPortion)} נק׳
          </div>
        )}
      </div>

      <div
        role="tablist"
        aria-label="סוג כמות"
        className="inline-flex rounded-full bg-secondary p-1 border border-border self-start"
      >
        {(["measured", "subjective"] as QuantityMode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "min-w-[92px] rounded-full px-4 py-2 text-sm font-semibold",
              mode === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
            )}
          >
            {m === "measured" ? "מדידה" : "לפי תחושה"}
          </button>
        ))}
      </div>

      {mode === "measured" ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="amt">
              כמות
            </label>
            <input
              id="amt"
              type="number"
              inputMode="decimal"
              step="0.1"
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
            <div className="flex flex-wrap gap-2">
              {unitList.map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  data-testid="unit-option"
                  onClick={() => {
                    setUnit(u);
                    setError(null);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm",
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
                  className="min-h-10 rounded-full border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
                >
                  יחידות נוספות
                </button>
              )}
            </div>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {SUBJECTIVES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={subjective === s}
              data-testid="subjective-option"
              data-value={s}
              onClick={() => setSubjective(s)}
              className={cn(
                "min-h-[64px] rounded-2xl border text-base font-semibold transition-colors",
                subjective === s
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              {SUBJECTIVE_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      {blockedMessage ? (
        <div
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          data-testid="points-preview"
          data-points="blocked"
          data-basis={preview.pointsBasis}
          role="status"
        >
          {blockedMessage}
        </div>
      ) : (
        <div
          className="rounded-xl border border-border bg-secondary/55 px-3 py-2 text-sm text-muted-foreground"
          data-testid="points-preview"
          data-points={preview.pointsValue}
          data-basis={preview.pointsBasis}
          aria-live="polite"
        >
          נקודות למנה הזו:{" "}
          <strong className="text-foreground">{formatPoints(preview.pointsValue)} נק׳</strong>
          {BASIS_LABEL[preview.pointsBasis] && (
            <span className="block text-[11px]">{BASIS_LABEL[preview.pointsBasis]}</span>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!!blockedMessage}
          className="flex-1 rounded-2xl bg-primary py-3 text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {submitLabel}
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
