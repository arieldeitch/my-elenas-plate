import { useState } from "react";
import { Scale } from "lucide-react";
import type { Unit, WeightBridge } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { parseAmount } from "@/lib/quantity";
import { BRIDGE_PROVENANCE_LABEL } from "@/lib/weight-bridges";
import { cn } from "@/lib/utils";

interface Props {
  /** What the bridge belongs to — one exact identity, never a family of foods. */
  source: {
    kind: WeightBridge["sourceKind"];
    key: string;
    referenceItemId?: string;
    estimatedProductId?: string;
  };
  /** The food's user-visible name (for the explanation line). */
  sourceName: string;
  /** The unit the grams must be stated for, e.g. "כף". */
  unit: Unit;
  onSaved: (bridge: WeightBridge) => void;
  onCancel: () => void;
}

/**
 * The one question the app is allowed to ask instead of guessing (DEC-037 R4):
 * "how many grams is 1 <unit> of THIS food?". The answer is stored for this
 * exact identity + unit and reused by both people; it is never applied to a
 * different brand, variant or reference row.
 */
export function WeightBridgeForm({ source, sourceName, unit, onSaved, onCancel }: Props) {
  const store = useStore();
  const [grams, setGrams] = useState("");
  const [provenance, setProvenance] = useState<WeightBridge["provenance"]>("user_measured");
  const [error, setError] = useState<string | null>(null);

  function save() {
    const value = parseAmount(grams);
    if (!Number.isFinite(value) || value <= 0) {
      return setError("יש להזין משקל בגרמים (מספר חיובי).");
    }
    if (!store.dishesSupported) {
      return setError("שמירת המרה תתאפשר אחרי עדכון השרת (מיגרציה 20260923).");
    }
    onSaved(
      store.saveWeightBridge({
        sourceKind: source.kind,
        sourceKey: source.key,
        referenceItemId: source.referenceItemId,
        estimatedProductId: source.estimatedProductId,
        unit,
        gramsPerUnit: value,
        provenance,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="weight-bridge-form">
      <div className="rounded-2xl bg-secondary/60 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Scale className="h-3.5 w-3.5" aria-hidden />
          כמה גרם יש ב־1 {unit}?
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {sourceName} — המאגר לא יודע להמיר {unit} לגרמים, והאפליקציה לא מנחשת. אחרי שתגדירו את
          ההמרה פעם אחת היא תישמר למאכל הזה בלבד ותשמש את שניכם.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="wb-grams">
          1 {unit} = כמה גרם
        </label>
        <input
          id="wb-grams"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          value={grams}
          placeholder="לדוגמה 15"
          onChange={(e) => {
            setGrams(e.target.value);
            setError(null);
          }}
          className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <div className="mb-1 text-sm font-medium">מאיפה המספר</div>
        <div
          role="radiogroup"
          aria-label="מקור ההמרה"
          className="inline-flex w-full rounded-full border border-border bg-secondary p-1"
        >
          {(["user_measured", "label"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={provenance === value}
              data-testid={`wb-provenance-${value}`}
              onClick={() => setProvenance(value)}
              className={cn(
                "min-h-10 flex-1 rounded-full px-3 text-sm font-semibold",
                provenance === value
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              {BRIDGE_PROVENANCE_LABEL[value]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          data-testid="wb-save"
          className="flex-1 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          שמירת ההמרה
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
