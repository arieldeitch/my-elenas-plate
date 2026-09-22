import { useMemo, useState } from "react";
import { Link2, Search } from "lucide-react";
import type { Food } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { buildFoodSearchIndex, searchFoodsDetailed } from "@/lib/food-search";
import { normalizeFoodName } from "@/lib/food-normalize";
import { referenceLine } from "./FoodSearch";
import { cn } from "@/lib/utils";

interface Props {
  initialName: string;
  /** The alias was saved (or the name already resolved) → continue with this reference food. */
  onLinked: (food: Food) => void;
  onCancel: () => void;
}

/**
 * A name the reference does not know (DEC-036 §6): it can only become a
 * PERSONAL ALIAS of an existing reference food. The person picks the reference
 * food; portion, unit and points then come from that food alone. Without a
 * matching reference food nothing can be saved as a scored food — the form
 * says so instead of inventing a value.
 */
export function PersonalAliasForm({ initialName, onLinked, onCancel }: Props) {
  const { foods, addPersonalAlias, personalAliasesSupported } = useStore();
  const [name, setName] = useState(initialName);
  const [query, setQuery] = useState(initialName);
  const [picked, setPicked] = useState<Food | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only reference foods can be targets (the coffee editor is not a reference food).
  const targets = useMemo(() => foods.filter((f) => f.kind !== "coffee"), [foods]);
  const index = useMemo(() => buildFoodSearchIndex(targets), [targets]);
  const results = useMemo(() => searchFoodsDetailed(index, query, 8), [index, query]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return setError("יש להזין שם אישי");
    if (!picked?.referenceGroupKey) return setError("יש לבחור את המאכל מהמאגר שהשם הזה מתאר");
    if (!personalAliasesSupported) {
      return setError(
        "שמירת שם אישי תתאפשר אחרי עדכון השרת (מיגרציה 20260922). אפשר להוסיף את המאכל מהמאגר ישירות.",
      );
    }
    if (normalizeFoodName(trimmed) === normalizeFoodName(picked.name)) {
      onLinked(picked);
      return;
    }
    onLinked(addPersonalAlias(trimmed, picked.referenceGroupKey));
  }

  return (
    <div className="flex flex-col gap-4" data-testid="personal-alias-form">
      <div className="rounded-2xl bg-secondary/60 px-3 py-2">
        <div className="text-xs text-muted-foreground">השם לא נמצא במאגר הניקוד</div>
        <div className="text-[11px] text-muted-foreground">
          מאכל מקבל ניקוד רק מהמאגר. אפשר לשמור את השם כשם אישי למאכל שקיים במאגר — הכמות, היחידה
          והנקודות יגיעו ממנו.
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="pa-name">
          השם האישי
        </label>
        <input
          id="pa-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="pa-target">
          המאכל במאגר
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="pa-target"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicked(null);
              setError(null);
            }}
            placeholder="חיפוש במאגר"
            className="w-full rounded-xl border border-input bg-card py-3 pr-10 pl-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="mt-2 space-y-1" data-testid="pa-results">
          {results.map(({ food, matchedAlias }) => (
            <button
              key={food.id}
              type="button"
              aria-pressed={picked?.id === food.id}
              data-testid="pa-option"
              onClick={() => {
                setPicked(food);
                setError(null);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-right",
                picked?.id === food.id
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{food.name}</div>
                {referenceLine(food) && (
                  <div className="truncate text-xs text-muted-foreground">
                    {referenceLine(food)}
                  </div>
                )}
                {matchedAlias && (
                  <div className="truncate text-[11px] text-muted-foreground/80">
                    נמצא לפי: {matchedAlias}
                  </div>
                )}
              </div>
              {picked?.id === food.id && <Link2 className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
          {results.length === 0 && (
            <div
              className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground"
              data-testid="pa-none"
            >
              אין מאכל מתאים במאגר — לא ניתן לשמור ניקוד לשם הזה. אפשר לבקש מאלנה להוסיף אותו לטבלת
              הניקוד.
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          data-testid="pa-save"
          disabled={!picked}
          className="flex-1 rounded-2xl bg-primary py-3 text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          קישור והמשך לכמות
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
