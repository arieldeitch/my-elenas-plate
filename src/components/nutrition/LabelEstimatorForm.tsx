import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import type { EstimatedProduct, LabelBasis, LabelInput } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { parseAmount } from "@/lib/quantity";
import { formatPoints } from "@/lib/points";
import {
  describeLabelBasis,
  ESTIMATED_LABEL,
  estimateFromLabel,
  validateLabel,
} from "@/lib/label-estimator";
import { cn } from "@/lib/utils";

interface Props {
  initialName: string;
  /** Editing an existing estimated product instead of creating one. */
  initial?: EstimatedProduct;
  onSaved: (product: EstimatedProduct) => void;
  onCancel: () => void;
}

const OPTIONAL_FIELDS = [
  ["proteinG", "חלבון (גרם)"],
  ["fiberG", "סיבים (גרם)"],
  ["saturatedFatG", "שומן רווי (גרם)"],
  ["addedSugarG", "סוכר (גרם)"],
  ["unsaturatedFatG", "שומן בלתי רווי (גרם)"],
] as const;

/**
 * "הערכת מוצר מלייבל" (DEC-037 R5): a product the canonical reference does not
 * have can still be logged — from the values printed on its package, entered by
 * hand, and only as a clearly marked ESTIMATE. Nothing is invented: a value the
 * label does not show is left empty and simply contributes nothing.
 */
export function LabelEstimatorForm({ initialName, initial, onSaved, onCancel }: Props) {
  const store = useStore();
  const [name, setName] = useState(initial?.name ?? initialName);
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [basis, setBasis] = useState<LabelBasis>(initial?.label.basis ?? "per_100g");
  const [servingWeight, setServingWeight] = useState(
    initial?.label.servingWeightG != null ? String(initial.label.servingWeightG) : "",
  );
  const [calories, setCalories] = useState(initial ? String(initial.label.calories) : "");
  const [optional, setOptional] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [key] of OPTIONAL_FIELDS) {
      const value = initial?.label[key];
      if (value != null) out[key] = String(value);
    }
    return out;
  });
  const [error, setError] = useState<string | null>(null);

  /** The label exactly as typed — empty optional fields stay absent. */
  const label = useMemo<LabelInput>(() => {
    const input: LabelInput = { basis, calories: parseAmount(calories) };
    if (basis === "per_serving") {
      const w = parseAmount(servingWeight);
      if (Number.isFinite(w)) input.servingWeightG = w;
    }
    for (const [key] of OPTIONAL_FIELDS) {
      const raw = optional[key];
      if (raw != null && raw.trim() !== "") {
        const v = parseAmount(raw);
        if (Number.isFinite(v)) input[key] = v;
      }
    }
    return input;
  }, [basis, calories, servingWeight, optional]);

  const errors = validateLabel(label);
  const preview = errors.length === 0 ? estimateFromLabel(label) : null;

  function handleSave() {
    if (errors.includes("calories_missing") || errors.includes("calories_invalid")) {
      return setError("יש להזין קלוריות מהלייבל (חובה).");
    }
    if (errors.includes("serving_weight_required") || errors.includes("serving_weight_invalid")) {
      return setError("במנה: יש להזין את משקל המנה בגרמים, אחרת אי אפשר לנרמל ל-100 גרם.");
    }
    if (errors.includes("negative_value"))
      return setError("ערכים תזונתיים לא יכולים להיות שליליים.");
    if (!name.trim()) return setError("יש להזין שם למוצר.");
    if (!store.dishesSupported) {
      return setError("שמירת מוצר מוערך תתאפשר אחרי עדכון השרת (מיגרציה 20260923).");
    }
    const product = store.saveEstimatedProduct({
      id: initial?.id,
      name,
      brand,
      label,
    });
    onSaved(product);
  }

  const field =
    "w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex flex-col gap-4" data-testid="label-estimator-form">
      <div className="rounded-2xl border border-info/30 bg-info-soft/40 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Info className="h-3.5 w-3.5" aria-hidden />
          {ESTIMATED_LABEL}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          המוצר לא נמצא במאגר. אפשר להקליד את הערכים מהאריזה והאפליקציה תחשב הערכה שקופה — היא
          מסומנת כהערכה בכל מקום ואינה ערך מהמאגר.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="le-name">
          שם המוצר
        </label>
        <input
          id="le-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          className={field}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="le-brand">
          מותג (לא חובה)
        </label>
        <input
          id="le-brand"
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className={field}
        />
      </div>

      <div>
        <div className="mb-1 text-sm font-medium">הערכים על האריזה מתייחסים ל…</div>
        <div
          role="radiogroup"
          aria-label="בסיס הערכים"
          className="inline-flex w-full rounded-full border border-border bg-secondary p-1"
        >
          {(
            [
              ["per_100g", "100 גרם"],
              ["per_serving", "מנה"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={basis === value}
              data-testid={`le-basis-${value}`}
              onClick={() => {
                setBasis(value);
                setError(null);
              }}
              className={cn(
                "min-h-10 flex-1 rounded-full px-3 text-sm font-semibold",
                basis === value ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {basis === "per_serving" && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="le-serving">
            משקל מנה (גרם)
          </label>
          <input
            id="le-serving"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={servingWeight}
            onChange={(e) => {
              setServingWeight(e.target.value);
              setError(null);
            }}
            className={field}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            בלי משקל המנה אי אפשר לנרמל את הערכים ל-100 גרם, ולכן לא תישמר הערכה.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="le-calories">
          קלוריות {basis === "per_100g" ? "ל-100 גרם" : "למנה"}
        </label>
        <input
          id="le-calories"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={calories}
          onChange={(e) => {
            setCalories(e.target.value);
            setError(null);
          }}
          className={field}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {OPTIONAL_FIELDS.map(([key, labelText]) => (
          <div key={key}>
            <label className="mb-1 block text-xs font-medium" htmlFor={`le-${key}`}>
              {labelText}
            </label>
            <input
              id={`le-${key}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={optional[key] ?? ""}
              onChange={(e) => {
                setOptional((prev) => ({ ...prev, [key]: e.target.value }));
                setError(null);
              }}
              className="w-full rounded-xl border border-input bg-card px-2.5 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
      </div>
      <p className="-mt-1 text-[11px] text-muted-foreground">
        שדה שלא מופיע על האריזה — פשוט להשאיר ריק. לא ממציאים ערכים.
      </p>

      <div
        className="rounded-xl border border-border bg-secondary/55 px-3 py-2 text-sm text-muted-foreground"
        data-testid="label-estimate-preview"
        data-points={preview ? preview.pointsPer100g : "invalid"}
        aria-live="polite"
      >
        {preview ? (
          <>
            הערכה:{" "}
            <strong className="text-foreground">
              {formatPoints(preview.pointsPer100g)} נק׳ ל-100 גרם
            </strong>
            <span className="block text-[11px]">
              {ESTIMATED_LABEL} · {describeLabelBasis(label)} · {preview.version}
            </span>
          </>
        ) : (
          "יש להשלים את הערכים כדי לראות הערכה."
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          data-testid="le-save"
          disabled={!preview}
          className="flex-1 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          שמירה והמשך
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
