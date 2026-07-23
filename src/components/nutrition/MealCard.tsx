import { ChevronLeft, Circle, MinusCircle, Check } from "lucide-react";
import type { DailyMeal, FoodEntry, MealSlotId } from "@/lib/domain";
import { MEAL_ICONS, MEAL_LABELS } from "@/lib/meal-slots";
import { cn } from "@/lib/utils";

function entrySummary(e: FoodEntry): string {
  if (e.mode === "subjective") return `${e.foodName} — ${e.subjective}`;
  return `${e.foodName} — ${e.amount} ${e.unit ?? ""}`.trim();
}

interface Props {
  meal: DailyMeal;
  onOpen: () => void;
}

export function MealCard({ meal, onOpen }: Props) {
  const Icon = MEAL_ICONS[meal.slot];
  const label = MEAL_LABELS[meal.slot];

  const shown = meal.entries.slice(0, 3);
  const more = meal.entries.length - shown.length;

  return (
    <button
      onClick={onOpen}
      className={cn(
        "group w-full text-right rounded-2xl bg-card border border-border p-4 shadow-soft",
        "hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors",
      )}
      aria-label={`${label}: ${meal.status === "logged" ? "תועד" : meal.status === "skipped" ? "לא נאכלה" : "עוד לא תועד"}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
            meal.status === "logged" && "bg-primary-soft text-primary",
            meal.status === "skipped" && "bg-muted text-muted-foreground",
            meal.status === "empty" && "bg-secondary text-muted-foreground",
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-foreground truncate">{label}</div>
            <StatusPill status={meal.status} />
          </div>

          {meal.status === "logged" && (
            <ul className="mt-2 space-y-1">
              {shown.map((e) => (
                <li key={e.id} className="text-sm text-muted-foreground truncate">
                  {entrySummary(e)}
                </li>
              ))}
              {more > 0 && (
                <li className="text-xs text-primary font-medium">+{more} נוספים</li>
              )}
            </ul>
          )}

          {meal.status === "empty" && (
            <div className="mt-1 text-sm text-muted-foreground">
              עוד לא תועד · <span className="text-primary font-medium">לחצו להוספת מאכל</span>
            </div>
          )}

          {meal.status === "skipped" && (
            <div className="mt-1 text-sm text-muted-foreground">לא נאכלה ארוחה</div>
          )}
        </div>
        <ChevronLeft className="mt-2 h-5 w-5 text-muted-foreground/60 shrink-0" aria-hidden />
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: DailyMeal["status"] }) {
  if (status === "logged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
        <Check className="h-3 w-3" />
        תועד
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <MinusCircle className="h-3 w-3" />
        דילוג
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive-soft px-2 py-0.5 text-xs font-medium text-destructive">
      <Circle className="h-3 w-3" />
      חסר
    </span>
  );
}
