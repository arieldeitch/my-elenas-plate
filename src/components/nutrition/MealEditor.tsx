import { useEffect, useState } from "react";
import { X, Pencil, Trash2, Star, Plus, MinusCircle, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import type { Food, FoodEntry, MealSlotId } from "@/lib/domain";
import { MEAL_ICONS, MEAL_LABELS } from "@/lib/meal-slots";
import { useStore, PROFILES } from "@/lib/store";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FoodSearch } from "./FoodSearch";
import { QuantitySelector } from "./QuantitySelector";

interface Props {
  slot: MealSlotId | null;
  onClose: () => void;
}

type View =
  | { kind: "list" }
  | { kind: "search" }
  | { kind: "quantity"; food: Food; editing?: FoodEntry };

export function MealEditor({ slot, onClose }: Props) {
  const store = useStore();
  const [view, setView] = useState<View>({ kind: "list" });

  useEffect(() => {
    if (!slot) return;
    // reset view when opening
    setView({ kind: "list" });
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

  const isEmpty = meal.entries.length === 0 && meal.status !== "skipped";

  function handleAdd(entry: Omit<FoodEntry, "id">) {
    store.addEntry(slot!, entry);
    setView({ kind: "search" });
  }

  function handleUpdate(entry: FoodEntry) {
    store.updateEntry(slot!, entry);
    setView({ kind: "list" });
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={MEAL_LABELS[slot]}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative flex flex-col w-full max-w-lg bg-card border border-border shadow-lg",
          "rounded-t-3xl sm:rounded-3xl max-h-[92vh] sm:max-h-[85vh] sm:my-8",
          "animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200",
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border p-4">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary shrink-0" aria-hidden>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-foreground">{MEAL_LABELS[slot]}</div>
            <div className="text-xs text-muted-foreground truncate">
              {profile.name} · {formatShortDate(store.selectedDate)}
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
          {view.kind === "list" && (
            <>
              {meal.status === "skipped" ? (
                <SkippedState onUndo={() => store.setMealSkipped(slot, false)} />
              ) : isEmpty ? (
                <EmptyState
                  onAdd={() => setView({ kind: "search" })}
                  onSkip={() => store.setMealSkipped(slot, true)}
                />
              ) : (
                <div className="space-y-2">
                  {meal.entries.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      isFavorite={store.favorites.includes(e.foodId)}
                      onToggleFavorite={() => store.toggleFavorite(e.foodId)}
                      onEdit={() => {
                        const food = store.foods.find((f) => f.id === e.foodId);
                        if (food) setView({ kind: "quantity", food, editing: e });
                      }}
                      onDelete={() => handleDelete(e)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {view.kind === "search" && (
            <FoodSearch
              onPick={(food) => setView({ kind: "quantity", food })}
              onCreate={handleCreateFood}
            />
          )}

          {view.kind === "quantity" && (
            <QuantitySelector
              food={view.food}
              initial={view.editing}
              submitLabel={view.editing ? "עדכון" : "הוספת המאכל"}
              onSubmit={(entry) => {
                if (view.editing) handleUpdate({ ...view.editing, ...entry });
                else handleAdd(entry);
              }}
              onCancel={() => setView(view.editing ? { kind: "list" } : { kind: "search" })}
            />
          )}
        </div>

        {/* Footer */}
        {view.kind === "list" && meal.status !== "skipped" && (
          <div className="border-t border-border p-3 flex gap-2 bg-card">
            <button
              onClick={() => setView({ kind: "search" })}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              הוספת מאכל
            </button>
            {!isEmpty && (
              <button
                onClick={onClose}
                className="rounded-2xl border border-border bg-card px-4 py-3 font-medium hover:bg-muted inline-flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                סיום
              </button>
            )}
            {isEmpty && (
              <button
                onClick={() => store.setMealSkipped(slot, true)}
                className="rounded-2xl border border-border bg-card px-4 py-3 font-medium hover:bg-muted"
              >
                לא נאכלה ארוחה
              </button>
            )}
          </div>
        )}

        {view.kind === "search" && (
          <div className="border-t border-border p-3 flex gap-2 bg-card">
            <button
              onClick={() => setView({ kind: "list" })}
              className="flex-1 rounded-2xl border border-border bg-card py-3 font-medium hover:bg-muted"
            >
              חזרה לארוחה
            </button>
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

function EmptyState({ onAdd, onSkip }: { onAdd: () => void; onSkip: () => void }) {
  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground">עוד לא תועדו מאכלים בארוחה הזו.</p>
      <div className="mt-6 flex flex-col gap-2 items-stretch max-w-xs mx-auto">
        <button
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> הוספת מאכל
        </button>
        <button
          onClick={onSkip}
          className="rounded-2xl border border-border bg-card py-3 font-medium text-muted-foreground hover:bg-muted"
        >
          לא נאכלה ארוחה
        </button>
      </div>
    </div>
  );
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
  entry, isFavorite, onToggleFavorite, onEdit, onDelete,
}: {
  entry: FoodEntry;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const detail =
    entry.mode === "measured"
      ? `${entry.amount} ${entry.unit ?? ""}`.trim()
      : entry.subjective ?? "";
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground truncate">{entry.foodName}</div>
        <div className="text-sm text-muted-foreground">{detail}</div>
      </div>
      <button
        onClick={onToggleFavorite}
        aria-label={isFavorite ? "הסרה ממועדפים" : "הוספה למועדפים"}
        className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"
      >
        <Star className={cn("h-4 w-4", isFavorite ? "text-warn fill-warn" : "text-muted-foreground")} />
      </button>
      <button
        onClick={onEdit}
        aria-label="עריכה"
        className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        aria-label="מחיקה"
        className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
