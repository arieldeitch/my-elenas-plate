import { useState } from "react";
import type { CoffeeMeta, CoffeeType, FoodEntry, MilkChoice, MilkType, Unit } from "@/lib/domain";
import { COFFEE_TYPES, COFFEE_UNITS, MILK_CHOICES, MILK_TYPES } from "@/lib/domain";
import { COFFEE_FOOD_ID, DEFAULT_COFFEE, normalizeCoffee, validateCoffee } from "@/lib/coffee";
import { parseAmount, validateMeasured } from "@/lib/quantity";
import { cn } from "@/lib/utils";

interface Props {
  /** Existing coffee entry when editing. */
  initial?: FoodEntry;
  onSubmit: (entry: Omit<FoodEntry, "id">) => void;
  onCancel: () => void;
  submitLabel?: string;
}

/**
 * Fast, low-friction coffee entry. Sensible defaults (אמריקנו · ללא חלב · כוס)
 * let the user save in one tap, while type / milk / quantity / note stay
 * adjustable. Milk type is only shown — and only stored — with "עם חלב".
 */
export function CoffeeSelector({ initial, onSubmit, onCancel, submitLabel }: Props) {
  const initialCoffee = initial?.coffee;
  const [type, setType] = useState<CoffeeType>(initialCoffee?.type ?? DEFAULT_COFFEE.type);
  const [milk, setMilk] = useState<MilkChoice>(initialCoffee?.milk ?? DEFAULT_COFFEE.milk);
  const [milkType, setMilkType] = useState<MilkType | undefined>(initialCoffee?.milkType);
  const [note, setNote] = useState<string>(initialCoffee?.note ?? "");
  const [amount, setAmount] = useState<string>(
    initial?.amount != null ? String(initial.amount) : "1",
  );
  const [unit, setUnit] = useState<Unit>((initial?.unit as Unit) ?? "כוס");
  const [error, setError] = useState<string | null>(null);

  function selectMilk(choice: MilkChoice) {
    setMilk(choice);
    // Clearing here mirrors normalizeCoffee: leaving "עם חלב" drops the milk type.
    if (choice === "ללא חלב") setMilkType(undefined);
    setError(null);
  }

  function handleSubmit() {
    const n = parseAmount(amount);
    if (validateMeasured({ amount: n, unit }).length) {
      setError("יש להזין כמות חיובית ולבחור יחידה");
      return;
    }
    const rawMeta: CoffeeMeta = { type, milk, milkType, note };
    if (validateCoffee(rawMeta).length) {
      setError("יש לבחור סוג קפה");
      return;
    }
    const coffee = normalizeCoffee(rawMeta);
    onSubmit({
      foodId: initial?.foodId ?? COFFEE_FOOD_ID,
      foodName: initial?.foodName ?? "קפה",
      mode: "measured",
      amount: n,
      unit,
      coffee,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-secondary/60 px-3 py-2">
        <div className="text-xs text-muted-foreground">משקה</div>
        <div className="font-semibold text-foreground">קפה</div>
      </div>

      <Field label="סוג הקפה">
        <ChipRow<CoffeeType>
          options={COFFEE_TYPES}
          value={type}
          onChange={(t) => {
            setType(t);
            setError(null);
          }}
        />
      </Field>

      <Field label="חלב">
        <div
          role="tablist"
          aria-label="בחירת חלב"
          className="inline-flex self-start rounded-full border border-border bg-secondary p-1"
        >
          {MILK_CHOICES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={milk === m}
              onClick={() => selectMilk(m)}
              className={cn(
                "min-w-[104px] rounded-full px-4 py-2 text-sm font-semibold",
                milk === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </Field>

      {milk === "עם חלב" && (
        <Field label="סוג החלב (לא חובה)">
          <ChipRow<MilkType>
            options={MILK_TYPES}
            value={milkType}
            onChange={(m) => setMilkType(m)}
            allowUnset
            onUnset={() => setMilkType(undefined)}
          />
        </Field>
      )}

      <Field label="כמות">
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={amount}
            aria-label="כמות"
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            className="w-20 rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex flex-wrap gap-2">
            {COFFEE_UNITS.map((u) => (
              <button
                key={u}
                type="button"
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
      </Field>

      <Field label="הערה (לא חובה)">
        <input
          type="text"
          value={note}
          aria-label="הערה"
          maxLength={120}
          onChange={(e) => setNote(e.target.value)}
          placeholder="לדוגמה: בלי סוכר"
          className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </Field>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {submitLabel ?? "הוספת הקפה"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-border bg-card px-4 py-3 font-medium hover:bg-muted"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-foreground">{label}</div>
      {children}
    </div>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  allowUnset,
  onUnset,
}: {
  options: readonly T[];
  value?: T;
  onChange: (v: T) => void;
  allowUnset?: boolean;
  onUnset?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => (active && allowUnset ? onUnset?.() : onChange(o))}
            className={cn(
              "rounded-full border px-3 py-2 text-sm",
              active
                ? "border-primary bg-primary-soft font-medium text-primary"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
