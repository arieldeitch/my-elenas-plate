import { useMemo, useState } from "react";
import type { EstimatedProduct, FoodEntry, Unit } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { parseAmount } from "@/lib/quantity";
import { formatPoints } from "@/lib/points";
import {
  describeLabelBasis,
  ESTIMATED_LABEL,
  estimatedPointsForGrams,
} from "@/lib/label-estimator";
import { buildBridgeIndex, describeBridge, resolveGrams } from "@/lib/weight-bridges";
import { WeightBridgeForm } from "./WeightBridgeForm";
import { cn } from "@/lib/utils";

interface Props {
  product: EstimatedProduct;
  onSubmit: (entry: Omit<FoodEntry, "id">) => void;
  onCancel: () => void;
}

/** Units offered for an estimated product: grams first, plus common kitchen units. */
const UNITS: Unit[] = ["גרם", "יחידה", "כף", "כוס", "מנה"];

/**
 * How much of a label-estimated product was eaten (DEC-037 R5/R6). Grams are
 * the native basis; any other unit needs an explicit bridge for THIS product —
 * the app asks once instead of guessing, exactly like a reference ingredient.
 */
export function EstimatedQuantityForm({ product, onSubmit, onCancel }: Props) {
  const store = useStore();
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState<Unit>("גרם");
  const [bridgeNeeded, setBridgeNeeded] = useState<Unit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bridges = useMemo(() => buildBridgeIndex(store.weightBridges), [store.weightBridges]);
  const parsed = parseAmount(amount);
  const resolution = resolveGrams(bridges, { kind: "estimated", key: product.id }, parsed, unit);
  const grams =
    resolution.kind === "weight" || resolution.kind === "bridged" ? resolution.grams : null;
  const preview = grams == null ? null : estimatedPointsForGrams(product.pointsPer100g, grams);

  function submit() {
    if (!Number.isFinite(parsed) || parsed <= 0) return setError("יש להזין כמות חיובית.");
    if (resolution.kind === "needs_bridge") {
      setBridgeNeeded(unit);
      return;
    }
    if (grams == null) return setError("לא ניתן להמיר את היחידה הזו לגרמים.");
    onSubmit({
      foodId: product.id,
      foodName: product.name,
      mode: "measured",
      amount: parsed,
      unit,
      estimatedProductId: product.id,
      consumedWeightG: grams,
    });
  }

  if (bridgeNeeded) {
    return (
      <WeightBridgeForm
        source={{ kind: "estimated", key: product.id, estimatedProductId: product.id }}
        sourceName={product.name}
        unit={bridgeNeeded}
        onSaved={() => setBridgeNeeded(null)}
        onCancel={() => setBridgeNeeded(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="estimated-quantity-form">
      <div className="rounded-2xl border border-info/30 bg-info-soft/40 px-3 py-2">
        <div className="text-xs text-muted-foreground">{ESTIMATED_LABEL}</div>
        <div className="font-semibold text-foreground">{product.name}</div>
        <div className="text-[11px] text-muted-foreground" data-testid="estimated-basis">
          {formatPoints(product.pointsPer100g)} נק׳ ל-100 גרם · {describeLabelBasis(product.label)}{" "}
          · {product.estimatorVersion}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="eq-amount">
          כמות
        </label>
        <input
          id="eq-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
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
          {UNITS.map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              data-testid="eq-unit"
              onClick={() => {
                setUnit(u);
                setError(null);
              }}
              className={cn(
                "rounded-full border px-3 py-2 text-sm",
                unit === u
                  ? "border-primary bg-primary-soft font-medium text-primary"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div
        className="rounded-xl border border-border bg-secondary/55 px-3 py-2 text-sm text-muted-foreground"
        data-testid="estimated-preview"
        data-points={preview ?? "needs_bridge"}
        aria-live="polite"
      >
        {preview == null ? (
          <>צריך לדעת כמה גרם יש ב־1 {unit} של המוצר הזה — נשאל פעם אחת ונשמור.</>
        ) : (
          <>
            יתווספו: <strong className="text-foreground">{formatPoints(preview)} נק׳</strong>
            <span className="block text-[11px]">
              {ESTIMATED_LABEL}
              {resolution.kind === "bridged" ? ` · ${describeBridge(resolution.bridge)}` : ""}
            </span>
          </>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          data-testid="eq-add"
          className="flex-1 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {preview == null ? "הגדרת המרה והוספה" : "הוספת המוצר"}
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
