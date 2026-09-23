import { useMemo, useState } from "react";
import { ChevronRight, Info, Plus, Scale, Search, Trash2, X } from "lucide-react";
import type { Dish, DishIngredient, EstimatedProduct, Unit, WeightBridge } from "@/lib/domain";
import { ALL_UNITS } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { parseAmount } from "@/lib/quantity";
import { formatPoints } from "@/lib/points";
import { buildFoodSearchIndex, searchFoodsDetailed } from "@/lib/food-search";
import {
  formatPortion,
  getReferenceIndex,
  resolvableUnits,
  selectableItems,
  type ReferenceRuntimeItem,
} from "@/lib/points-reference";
import { dishTotals, formatPointsPerGram, resolveIngredient } from "@/lib/dishes";
import { buildBridgeIndex, describeBridge } from "@/lib/weight-bridges";
import { ESTIMATED_SHORT } from "@/lib/label-estimator";
import { LabelEstimatorForm } from "./LabelEstimatorForm";
import { WeightBridgeForm } from "./WeightBridgeForm";
import { cn } from "@/lib/utils";

interface Props {
  /** The dish being edited, or null for a new one. */
  dish: Dish | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (dish: Dish) => void;
}

type View =
  | { kind: "list" }
  | { kind: "pick" }
  | { kind: "quantity"; source: PickedSource }
  | { kind: "bridge"; source: PickedSource; unit: Unit; amount: number; bridgeUnit: Unit }
  | { kind: "label"; name: string };

type PickedSource =
  | { kind: "reference"; name: string; groupKey: string; item: ReferenceRuntimeItem }
  | { kind: "estimated"; product: EstimatedProduct };

/**
 * Create / edit a household dish (DEC-037 R2, R3, R7, R8).
 *
 * The happy path is short: add a gram-based reference ingredient, type grams,
 * done. The weight-bridge question appears only when the chosen reference
 * portion is not weight-based and the person typed grams. Estimated
 * ingredients are allowed and always marked.
 */
export function DishEditor({ dish, open, onClose, onSaved }: Props) {
  const store = useStore();
  const index = getReferenceIndex();
  const [name, setName] = useState(dish?.name ?? "");
  const [ingredients, setIngredients] = useState<DishIngredient[]>(dish?.ingredients ?? []);
  const [finalWeight, setFinalWeight] = useState(
    dish?.finalWeightG != null ? String(dish.finalWeightG) : "",
  );
  const [usualServing, setUsualServing] = useState(
    dish?.usualServingWeightG != null ? String(dish.usualServingWeightG) : "",
  );
  const [view, setView] = useState<View>({ kind: "list" });
  const [error, setError] = useState<string | null>(null);

  const bridgeIndex = useMemo(() => buildBridgeIndex(store.weightBridges), [store.weightBridges]);
  const totals = useMemo(
    () => dishTotals(ingredients, parseAmount(finalWeight) || 0),
    [ingredients, finalWeight],
  );

  if (!open) return null;

  /**
   * Resolves and appends an ingredient. `extraBridge` is the bridge that was
   * just saved in this flow: the store state has not re-rendered yet, so it is
   * merged into the index explicitly instead of relying on a stale closure.
   */
  function addIngredient(
    source: PickedSource,
    amount: number,
    unit: Unit,
    extraBridge?: WeightBridge,
  ) {
    const bridges = extraBridge
      ? buildBridgeIndex([extraBridge, ...store.weightBridges])
      : bridgeIndex;
    const request =
      source.kind === "reference"
        ? ({
            sourceKind: "reference" as const,
            item: source.item,
            name: source.name,
            groupKey: source.groupKey,
            sourceVersion: index.version,
            amount,
            unit,
          } as const)
        : ({ sourceKind: "estimated" as const, product: source.product, amount, unit } as const);
    const resolved = resolveIngredient(request, bridges);
    if (resolved.ok) {
      setIngredients((prev) => [...prev, resolved.ingredient]);
      setView({ kind: "list" });
      setError(null);
      return;
    }
    if (resolved.reason === "needs_bridge" && resolved.bridgeUnit) {
      // Never guess a density: ask once, store it for this identity, continue.
      setView({ kind: "bridge", source, unit, amount, bridgeUnit: resolved.bridgeUnit });
      return;
    }
    setError(
      resolved.reason === "invalid_amount"
        ? "יש להזין כמות חיובית."
        : "היחידה שנבחרה לא נתמכת עבור המאכל הזה.",
    );
  }

  function save() {
    const weight = parseAmount(finalWeight);
    if (!name.trim()) return setError("יש להזין שם לתבשיל.");
    if (ingredients.length === 0) return setError("יש להוסיף לפחות מרכיב אחד.");
    if (!Number.isFinite(weight) || weight <= 0) {
      return setError("יש להזין את משקל התבשיל המוכן בגרמים — ממנו נגזר הניקוד לגרם.");
    }
    if (!store.dishesSupported) {
      return setError("שמירת תבשילים תתאפשר אחרי עדכון השרת (מיגרציה 20260923).");
    }
    const usual = usualServing.trim() === "" ? undefined : parseAmount(usualServing);
    if (usual != null && (!Number.isFinite(usual) || usual <= 0)) {
      return setError("מנה רגילה: משקל בגרמים או ריק.");
    }
    // A dish name is unique per household in the database (archived dishes
    // included). Saving a second one would be refused for good and would take
    // the servings logged from it with it, so it is refused here instead.
    const clash = store.findDishByName(name, dish?.id);
    if (clash) {
      return setError(
        clash.isActive
          ? `כבר יש תבשיל בשם "${clash.name}" — אפשר לערוך אותו או לבחור שם אחר.`
          : `תבשיל בשם "${clash.name}" נמצא בארכיון — אפשר להחזיר אותו מהארכיון או לבחור שם אחר.`,
      );
    }
    const saved = store.saveDish({
      id: dish?.id,
      name,
      ingredients,
      finalWeightG: weight,
      usualServingWeightG: usual,
    });
    onSaved?.(saved);
    onClose();
  }

  const field =
    "w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dish ? `עריכת תבשיל: ${dish.name}` : "תבשיל חדש"}
      data-testid="dish-editor"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        aria-label="סגירה"
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="keyboard-safe-sheet relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-lg sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-foreground">{dish ? "עריכת תבשיל" : "תבשיל חדש"}</h2>
            <p className="text-[11px] text-muted-foreground">
              {dish
                ? "עריכה יוצרת גרסה חדשה. ארוחות שנרשמו כבר לא משתנות."
                : "מרכיבים → משקל סופי → ניקוד לגרם."}
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

        <div className="keyboard-safe-scroll flex-1 overflow-y-auto p-4">
          {view.kind === "list" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="dish-name">
                  שם התבשיל
                </label>
                <input
                  id="dish-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  placeholder="לדוגמה: תבשיל עדשים"
                  className={field}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">מרכיבים</span>
                  <button
                    type="button"
                    onClick={() => setView({ kind: "pick" })}
                    data-testid="dish-add-ingredient"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-primary/40"
                  >
                    <Plus className="h-4 w-4" />
                    הוספת מרכיב
                  </button>
                </div>
                {ingredients.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    עדיין אין מרכיבים.
                  </p>
                ) : (
                  <ul className="space-y-1" data-testid="dish-ingredients">
                    {ingredients.map((ing, i) => (
                      <li
                        key={`${ing.name}-${i}`}
                        data-testid="dish-ingredient"
                        data-source={ing.sourceKind}
                        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {ing.name}
                            {ing.sourceKind === "estimated" && (
                              <span className="mr-2 rounded-full bg-info-soft px-1.5 py-0.5 text-[10px] font-semibold text-info">
                                {ESTIMATED_SHORT}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {ing.amount} {ing.unit}
                            {ing.bridge ? ` · ${describeBridge(ing.bridge)}` : ""} ·{" "}
                            {formatPoints(ing.points)} נק׳
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`הסרה: ${ing.name}`}
                          onClick={() => setIngredients((prev) => prev.filter((_, j) => j !== i))}
                          className="grid h-9 w-9 place-items-center rounded-xl text-destructive hover:bg-muted"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="dish-weight">
                  משקל התבשיל המוכן (גרם)
                </label>
                <input
                  id="dish-weight"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  value={finalWeight}
                  onChange={(e) => {
                    setFinalWeight(e.target.value);
                    setError(null);
                  }}
                  className={field}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="dish-usual">
                  מנה רגילה (גרם, לא חובה)
                </label>
                <input
                  id="dish-usual"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  value={usualServing}
                  onChange={(e) => setUsualServing(e.target.value)}
                  className={field}
                />
              </div>

              <div
                className="rounded-xl border border-border bg-secondary/55 px-3 py-2 text-sm text-muted-foreground"
                data-testid="dish-totals"
                data-total-points={totals.totalPoints}
                data-points-per-gram={totals.pointsPerGram}
                aria-live="polite"
              >
                סה״כ:{" "}
                <strong className="text-foreground">{formatPoints(totals.totalPoints)} נק׳</strong>
                {totals.pointsPerGram > 0 && (
                  <span className="block text-[11px]">
                    {formatPointsPerGram(totals.pointsPerGram)}
                  </span>
                )}
                {totals.hasEstimatedIngredient && (
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-info">
                    <Info className="h-3 w-3" aria-hidden />
                    התבשיל כולל מרכיב בהערכה
                  </span>
                )}
              </div>

              {error && (
                <div className="text-sm text-destructive" role="alert">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={save}
                data-testid="dish-save"
                className="min-h-12 w-full rounded-2xl bg-primary px-4 font-semibold text-primary-foreground"
              >
                שמירת התבשיל
              </button>
            </div>
          )}

          {view.kind === "pick" && (
            <IngredientPicker
              onPickReference={(source) => setView({ kind: "quantity", source })}
              onPickEstimated={(product) =>
                setView({ kind: "quantity", source: { kind: "estimated", product } })
              }
              onCreateEstimated={(searchName) => setView({ kind: "label", name: searchName })}
              onCancel={() => setView({ kind: "list" })}
            />
          )}

          {view.kind === "quantity" && (
            <IngredientQuantity
              source={view.source}
              onSubmit={(amount, unit) => addIngredient(view.source, amount, unit)}
              onCancel={() => setView({ kind: "list" })}
              error={error}
            />
          )}

          {view.kind === "bridge" && (
            <WeightBridgeForm
              source={
                view.source.kind === "reference"
                  ? {
                      kind: "reference",
                      key: view.source.groupKey,
                      referenceItemId: view.source.item.id,
                    }
                  : {
                      kind: "estimated",
                      key: view.source.product.id,
                      estimatedProductId: view.source.product.id,
                    }
              }
              sourceName={
                view.source.kind === "reference" ? view.source.name : view.source.product.name
              }
              unit={view.bridgeUnit}
              onSaved={(bridge) => {
                // Re-resolve immediately with the bridge that was just saved.
                addIngredient(view.source, view.amount, view.unit, bridge);
              }}
              onCancel={() => setView({ kind: "list" })}
            />
          )}

          {view.kind === "label" && (
            <LabelEstimatorForm
              initialName={view.name}
              onSaved={(product) =>
                setView({ kind: "quantity", source: { kind: "estimated", product } })
              }
              onCancel={() => setView({ kind: "list" })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Search the canonical reference, or reuse / create a label-estimated product. */
function IngredientPicker({
  onPickReference,
  onPickEstimated,
  onCreateEstimated,
  onCancel,
}: {
  onPickReference: (source: Extract<PickedSource, { kind: "reference" }>) => void;
  onPickEstimated: (product: EstimatedProduct) => void;
  onCreateEstimated: (name: string) => void;
  onCancel: () => void;
}) {
  const store = useStore();
  const index = getReferenceIndex();
  const [query, setQuery] = useState("");
  const searchIndex = useMemo(
    () => buildFoodSearchIndex(store.foods.filter((f) => f.kind !== "coffee")),
    [store.foods],
  );
  const results = useMemo(() => searchFoodsDetailed(searchIndex, query, 8), [searchIndex, query]);
  const estimated = useMemo(
    () =>
      store.estimatedProducts.filter((p) =>
        query.trim() === "" ? true : p.name.includes(query.trim()),
      ),
    [store.estimatedProducts, query],
  );

  /** A reference food may have several portions; each is a separate choice. */
  const referenceChoices = results.flatMap((hit) => {
    const group = hit.food.referenceGroupKey
      ? index.groupsByKey.get(hit.food.referenceGroupKey)
      : undefined;
    if (!group) return [];
    return selectableItems(group).map((item) => ({
      name: hit.food.name,
      groupKey: group.key,
      item,
    }));
  });

  return (
    <div className="space-y-3" data-testid="ingredient-picker">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          aria-label="חיפוש מרכיב"
          placeholder="חיפוש מרכיב במאגר"
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-input bg-card py-3 pr-10 pl-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1">
        {referenceChoices.map((choice) => (
          <button
            key={`${choice.groupKey}-${choice.item.id}`}
            type="button"
            data-testid="ingredient-option"
            onClick={() => onPickReference({ kind: "reference", ...choice })}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-right hover:border-primary/40"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{choice.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {formatPortion(choice.item.portion)} · {formatPoints(choice.item.points)} נק׳
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}

        {estimated.map((product) => (
          <button
            key={product.id}
            type="button"
            data-testid="ingredient-option-estimated"
            onClick={() => onPickEstimated(product)}
            className="flex w-full items-center gap-2 rounded-xl border border-info/30 bg-info-soft/30 px-3 py-2 text-right hover:border-info/60"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {product.name}
                <span className="mr-2 rounded-full bg-card px-1.5 py-0.5 text-[10px] font-semibold text-info">
                  {ESTIMATED_SHORT}
                </span>
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {formatPoints(product.pointsPer100g)} נק׳ ל-100 גרם
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}
      </div>

      {query.trim() !== "" && (
        <button
          type="button"
          data-testid="ingredient-create-estimated"
          onClick={() => onCreateEstimated(query.trim())}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-info/50 bg-info-soft/30 px-3 py-3 text-right text-sm font-medium text-info"
        >
          <Plus className="h-4 w-4" />“{query.trim()}” לא במאגר — הערכת מוצר מלייבל
        </button>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="min-h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm font-medium"
      >
        ביטול
      </button>
    </div>
  );
}

/** Amount + unit for the picked ingredient. Grams are always offered. */
function IngredientQuantity({
  source,
  onSubmit,
  onCancel,
  error,
}: {
  source: PickedSource;
  onSubmit: (amount: number, unit: Unit) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const units: Unit[] =
    source.kind === "reference"
      ? Array.from(new Set<Unit>(["גרם", ...resolvableUnits(source.item.portion)]))
      : ["גרם"];
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState<Unit>(units[0] ?? "גרם");
  const [showAll, setShowAll] = useState(false);
  const unitList = showAll ? ALL_UNITS : units;

  return (
    <div className="space-y-3" data-testid="ingredient-quantity">
      <div className="rounded-2xl bg-secondary/60 px-3 py-2">
        <div className="text-xs text-muted-foreground">מרכיב</div>
        <div className="font-semibold text-foreground">
          {source.kind === "reference" ? source.name : source.product.name}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {source.kind === "reference"
            ? `מנת ייחוס: ${formatPortion(source.item.portion)} = ${formatPoints(source.item.points)} נק׳`
            : `הערכה: ${formatPoints(source.product.pointsPer100g)} נק׳ ל-100 גרם`}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="ing-amount">
          כמות
        </label>
        <input
          id="ing-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
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
              data-testid="ing-unit"
              onClick={() => setUnit(u)}
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
          {!showAll && source.kind === "reference" && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="min-h-10 rounded-full border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
            >
              יחידות נוספות
            </button>
          )}
        </div>
        {source.kind === "reference" && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Scale className="h-3 w-3" aria-hidden />
            אפשר לשקול בגרמים — אם המאגר לא יודע להמיר, נשאל פעם אחת כמה גרם ביחידה.
          </p>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          data-testid="ing-add"
          onClick={() => onSubmit(parseAmount(amount), unit)}
          className="flex-1 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground"
        >
          הוספה לתבשיל
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-border bg-card px-4 py-3 font-medium"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
