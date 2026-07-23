import { useState } from "react";
import type { Food, FoodEntry, QuantityMode, SubjectiveAmount, Unit } from "@/lib/domain";
import { ALL_UNITS } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface Props {
  food: Food;
  initial?: FoodEntry;
  onSubmit: (entry: Omit<FoodEntry, "id">) => void;
  onCancel: () => void;
  submitLabel?: string;
}

const SUBJECTIVES: SubjectiveAmount[] = ["מעט", "במידה", "הרבה", "מוגזם"];

export function QuantitySelector({ food, initial, onSubmit, onCancel, submitLabel = "הוספת המאכל" }: Props) {
  const [mode, setMode] = useState<QuantityMode>(initial?.mode ?? "measured");
  const [amount, setAmount] = useState<string>(
    initial?.amount != null ? String(initial.amount) : "1",
  );
  const [unit, setUnit] = useState<Unit>(
    (initial?.unit ?? food.defaultUnit ?? "יחידה") as Unit,
  );
  const [subjective, setSubjective] = useState<SubjectiveAmount>(
    initial?.subjective ?? "במידה",
  );
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggested = food.suggestedUnits ?? [food.defaultUnit ?? "יחידה"];
  const unitList = showAllUnits ? ALL_UNITS : suggested;

  function handleSubmit() {
    if (mode === "measured") {
      const n = Number(amount.replace(",", "."));
      if (!isFinite(n) || n <= 0) {
        setError("יש להזין כמות חיובית");
        return;
      }
      if (!unit) {
        setError("יש לבחור יחידה");
        return;
      }
      onSubmit({
        foodId: food.id,
        foodName: food.name,
        mode: "measured",
        amount: n,
        unit,
      });
    } else {
      onSubmit({
        foodId: food.id,
        foodName: food.name,
        mode: "subjective",
        subjective,
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-secondary/60 px-3 py-2">
        <div className="text-xs text-muted-foreground">נבחר</div>
        <div className="font-semibold text-foreground">{food.name}</div>
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
            onClick={() => { setMode(m); setError(null); }}
            className={cn(
              "min-w-[92px] rounded-full px-4 py-2 text-sm font-semibold",
              mode === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
            )}
          >
            {m === "measured" ? "מדידה" : "תחושה"}
          </button>
        ))}
      </div>

      {mode === "measured" ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="amt">כמות</label>
            <input
              id="amt"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); }}
              className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">יחידה</div>
            <div className="flex flex-wrap gap-2">
              {unitList.map((u) => (
                <button
                  key={u}
                  onClick={() => { setUnit(u); setError(null); }}
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
                  onClick={() => setShowAllUnits(true)}
                  className="rounded-full border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
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
              onClick={() => setSubjective(s)}
              className={cn(
                "min-h-[64px] rounded-2xl border text-base font-semibold transition-colors",
                subjective === s
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          className="flex-1 rounded-2xl bg-primary py-3 text-primary-foreground font-semibold hover:bg-primary/90"
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
