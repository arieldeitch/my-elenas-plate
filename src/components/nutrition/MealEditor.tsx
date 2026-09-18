import { useEffect, useRef, useState } from "react";
import { X, Pencil, Trash2, Star, MinusCircle, RotateCcw, Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Food, FoodEntry, MealSlotId } from "@/lib/domain";
import { MEAL_ICONS, MEAL_LABELS } from "@/lib/meal-slots";
import { useStore, PROFILES } from "@/lib/store";
import { formatShortDate } from "@/lib/format";
import { coffeeSummary } from "@/lib/coffee";
import { canStep, formatQuantity, stepAmount } from "@/lib/quantity";
import { cn } from "@/lib/utils";
import { FoodSearch } from "./FoodSearch";
import { QuantitySelector } from "./QuantitySelector";
import { CoffeeSelector } from "./CoffeeSelector";

interface Props {
  slot: MealSlotId | null;
  onClose: () => void;
}

/**
 * M2 logging loop: ONE meal view — what is already in the meal (editable rows)
 * plus the search / recents right below it — so adding never bounces between a
 * "list" and a "search" screen. Quantity and coffee are steps, not places.
 */
type View =
  | { kind: "meal" }
  | { kind: "quantity"; food: Food; editing?: FoodEntry }
  | { kind: "coffee"; editing?: FoodEntry };

export function MealEditor({ slot, onClose }: Props) {
  const store = useStore();
  const [view, setView] = useState<View>({ kind: "meal" });
  // M2-5: the row that was just quick-added is highlighted briefly so "tap + once"
  // needs no hunting. Cleared when another meal opens.
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset the view ONLY when a different meal opens. Depending on `onClose`
  // (a fresh function each parent render) would reset the editor on every
  // background sync re-render, losing the user's place mid-flow.
  useEffect(() => {
    if (!slot) return;
    setView({ kind: "meal" });
    setJustAdded(null);
    // Focus the panel for Escape / screen readers unless a child (the search box
    // of an empty meal) already took focus — child effects run first.
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
  }, [slot]);

  // Escape-to-close + scroll lock; may re-run when onClose changes without
  // disturbing the current view.
  useEffect(() => {
    if (!slot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [slot, onClose]);

  if (!slot) return null;

  const meal = store.getDay(store.activeProfile, toISO(store.selectedDate)).meals[slot];
  const Icon = MEAL_ICONS[slot];
  const profile = PROFILES.find((p) => p.id === store.activeProfile)!;
  const isEmpty = meal.entries.length === 0;

  function handleAdd(entry: Omit<FoodEntry, "id">) {
    store.addEntry(slot!, entry);
    setView({ kind: "meal" });
  }

  /**
   * One-tap add from a favourite / recent chip: the food's usual quantity
   * (1 × its default unit) is applied immediately and can be corrected from the
   * toast or the row — the common case is "the usual", the rare case still has
   * the full editor. Foods without a default unit, and coffee, still ask.
   */
  function handleQuickAdd(food: Food) {
    if (food.kind === "coffee") {
      setView({ kind: "coffee" });
      return;
    }
    const unit = food.defaultUnit;
    if (!unit) {
      setView({ kind: "quantity", food });
      return;
    }
    const added = store.addEntry(slot!, {
      foodId: food.id,
      foodName: food.name,
      mode: "measured",
      amount: 1,
      unit,
    });
    setJustAdded(added.id);
    toast(`נוסף: ${food.name} · ${formatQuantity(added)}`, { duration: 2500 });
  }

  /** M2-5: one-tap − / + on a count-unit row; the same upsert path as any edit. */
  function handleStep(entry: FoodEntry, direction: 1 | -1) {
    const amount = stepAmount(entry, direction);
    if (amount == null) return;
    store.updateEntry(slot!, { ...entry, amount });
  }

  function handleUpdate(entry: FoodEntry) {
    store.updateEntry(slot!, entry);
    setView({ kind: "meal" });
  }

  function handleDelete(entry: FoodEntry) {
    const removed = store.removeEntry(slot!, entry.id);
    if (removed) {
      toast("המאכל הוסר", {
        action: {
          label: "ביטול",
          onClick: () => store.restoreEntry(slot!, removed),
        },
      });
    }
  }

  function handleCreateFood(name: string) {
    const f = store.addFood(name);
    setView({ kind: "quantity", food: f });
  }

  function handlePick(food: Food) {
    if (food.kind === "coffee") setView({ kind: "coffee" });
    else setView({ kind: "quantity", food });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${MEAL_LABELS[slot]} · ${profile.name}`}
      data-owner={profile.id}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative flex flex-col w-full max-w-lg bg-card border border-border shadow-lg outline-none",
          "rounded-t-3xl sm:rounded-3xl max-h-[92vh] sm:max-h-[85vh] sm:my-8",
          "animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200",
        )}
        style={{ borderTopColor: profile.color, borderTopWidth: 3 }}
      >
        {/* Header — whose meal this is, unmistakably: name + personal colour. */}
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div
            className="grid h-11 w-11 place-items-center rounded-xl shrink-0"
            style={{ backgroundColor: profile.tint, color: profile.color }}
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-foreground">{MEAL_LABELS[slot]}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="grid h-4 w-4 place-items-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: profile.color }}
                aria-hidden
              >
                {profile.initials}
              </span>
              <span className="truncate" data-testid="meal-owner">
                {profile.name} · {formatShortDate(store.selectedDate)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {view.kind === "meal" &&
            (meal.status === "skipped" ? (
              <SkippedState onUndo={() => store.setMealSkipped(slot, false)} />
            ) : (
              <div className="space-y-4">
                {!isEmpty && (
                  <div className="space-y-2" data-testid="meal-entries">
                    {meal.entries.map((e) => (
                      <EntryRow
                        key={e.id}
                        entry={e}
                        isFavorite={store.favorites.includes(e.foodId)}
                        onToggleFavorite={() => store.toggleFavorite(e.foodId)}
                        onEdit={() => {
                          if (e.coffee) {
                            setView({ kind: "coffee", editing: e });
                            return;
                          }
                          const food = store.foods.find((f) => f.id === e.foodId);
                          if (food) setView({ kind: "quantity", food, editing: e });
                        }}
                        onDelete={() => handleDelete(e)}
                        onStep={(dir) => handleStep(e, dir)}
                        highlighted={e.id === justAdded}
                      />
                    ))}
                  </div>
                )}
                <FoodSearch
                  onPick={handlePick}
                  onQuickAdd={handleQuickAdd}
                  onCreate={handleCreateFood}
                  onAddCoffee={() => setView({ kind: "coffee" })}
                  autoFocus={isEmpty}
                />
              </div>
            ))}

          {view.kind === "quantity" && (
            <QuantitySelector
              food={view.food}
              initial={view.editing}
              submitLabel={view.editing ? "עדכון" : "הוספת המאכל"}
              onSubmit={(entry) => {
                if (view.editing) handleUpdate({ ...view.editing, ...entry });
                else handleAdd(entry);
              }}
              onCancel={() => setView({ kind: "meal" })}
            />
          )}

          {view.kind === "coffee" && (
            <CoffeeSelector
              initial={view.editing}
              submitLabel={view.editing ? "עדכון" : "הוספת הקפה"}
              onSubmit={(entry) => {
                if (view.editing) handleUpdate({ ...view.editing, ...entry });
                else handleAdd(entry);
              }}
              onCancel={() => setView({ kind: "meal" })}
            />
          )}
        </div>

        {/* Footer: one primary action. Empty meal → offer "skipped"; otherwise done. */}
        {view.kind === "meal" && meal.status !== "skipped" && (
          <div className="border-t border-border p-3 flex gap-2 bg-card">
            {isEmpty ? (
              <button
                onClick={() => store.setMealSkipped(slot, true)}
                className="flex-1 rounded-2xl border border-border bg-card py-3 font-medium text-muted-foreground hover:bg-muted"
              >
                לא נאכלה ארוחה
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-4 w-4" />
                סיום
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function SkippedState({ onUndo }: { onUndo: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <MinusCircle className="h-6 w-6" />
      </div>
      <p className="mt-3 text-foreground font-medium">לא נאכלה ארוחה</p>
      <p className="text-sm text-muted-foreground mt-1">אפשר להוסיף מאכל בכל שלב.</p>
      <button
        onClick={onUndo}
        className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        <RotateCcw className="h-4 w-4" />
        ביטול הסימון
      </button>
    </div>
  );
}

function EntryRow({
  entry,
  isFavorite,
  highlighted,
  onToggleFavorite,
  onEdit,
  onDelete,
  onStep,
}: {
  entry: FoodEntry;
  isFavorite: boolean;
  highlighted?: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStep: (direction: 1 | -1) => void;
}) {
  const quantityText = formatQuantity(entry);
  const detail = entry.coffee
    ? [coffeeSummary(entry.coffee), quantityText].filter(Boolean).join(" · ")
    : quantityText;
  const steppable = canStep(entry);
  const canDecrement = steppable && stepAmount(entry, -1) != null;

  return (
    <div
      data-testid="meal-entry"
      data-entry-id={entry.id}
      data-quantity={quantityText}
      className={cn(
        "rounded-2xl border border-border bg-card p-2 pr-3 transition-colors duration-700",
        highlighted && "border-primary/40 bg-primary-soft/40",
      )}
    >
      {/* Line 1: the food + the rare actions */}
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground">{entry.foodName}</div>
          {entry.coffee && <div className="truncate text-xs text-muted-foreground">{detail}</div>}
          {entry.coffee?.note && (
            <div className="truncate text-xs text-muted-foreground/80">{entry.coffee.note}</div>
          )}
        </div>
        <button
          onClick={onToggleFavorite}
          aria-label={
            isFavorite ? `הסרת ${entry.foodName} מהמועדפים` : `הוספת ${entry.foodName} למועדפים`
          }
          className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
        >
          <Star
            className={cn("h-4 w-4", isFavorite ? "text-warn fill-warn" : "text-muted-foreground")}
          />
        </button>
        <button
          onClick={onEdit}
          aria-label={`עריכה: ${entry.foodName}`}
          className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          aria-label={`מחיקה: ${entry.foodName}`}
          className="grid h-11 w-11 place-items-center rounded-xl text-destructive hover:bg-muted"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Line 2: the quantity — one-tap − / + for count units (M2-5), text otherwise */}
      {steppable ? (
        <div
          className="mt-1 inline-flex items-center rounded-full border border-border bg-secondary"
          role="group"
          aria-label={`כמות של ${entry.foodName}`}
        >
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={!canDecrement}
            aria-label={`פחות ${entry.foodName}`}
            data-testid="qty-minus"
            className="grid h-10 w-11 place-items-center rounded-full text-foreground hover:bg-card disabled:text-muted-foreground/50 disabled:cursor-not-allowed"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span
            className="min-w-[84px] px-1 text-center text-sm font-medium text-foreground tabular-nums"
            aria-live="polite"
            data-testid="qty-value"
          >
            {quantityText}
          </span>
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label={`עוד ${entry.foodName}`}
            data-testid="qty-plus"
            className="grid h-10 w-11 place-items-center rounded-full text-foreground hover:bg-card"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ) : (
        !entry.coffee && <div className="mt-0.5 text-sm text-muted-foreground">{detail}</div>
      )}
    </div>
  );
}
