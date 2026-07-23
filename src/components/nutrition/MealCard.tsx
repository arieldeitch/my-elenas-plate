import { Check, MinusCircle, CircleDashed, CircleDot } from "lucide-react";
import type { DailyMeal } from "@/lib/domain";
import { MEAL_ICONS, MEAL_LABELS } from "@/lib/meal-slots";
import { cn } from "@/lib/utils";

interface Props {
  meal: DailyMeal;
  onOpen: () => void;
}

export function MealCard({ meal, onOpen }: Props) {
  const Icon = MEAL_ICONS[meal.slot];
  const label = MEAL_LABELS[meal.slot];
  const status = meal.status;

  const statusText =
    status === "logged" ? "תועד" : status === "skipped" ? "לא נאכלה" : "עוד לא תועד";

  return (
    <button
      onClick={onOpen}
      aria-label={`${label}: ${statusText}`}
      className={cn(
        "group flex w-full flex-col items-center gap-2.5 rounded-2xl border bg-card p-4 text-center shadow-soft transition-all min-h-[132px]",
        "hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        status === "logged" && "border-border",
        status === "skipped" && "border-border",
        status === "empty" && "border-border",
      )}
    >
      <div
        className={cn(
          "grid h-14 w-14 place-items-center rounded-full",
          status === "logged" && "bg-primary-soft text-primary",
          status === "skipped" && "bg-muted text-muted-foreground",
          status === "empty" && "bg-info-soft text-info",
        )}
        aria-hidden
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-sm font-semibold text-foreground leading-tight">{label}</div>
      <StatusPill status={status} />
    </button>
  );
}

function StatusPill({ status }: { status: DailyMeal["status"] }) {
  if (status === "logged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
        <Check className="h-3 w-3" aria-hidden />
        תועד
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <MinusCircle className="h-3 w-3" aria-hidden />
        לא נאכלה
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <CircleDashed className="h-3 w-3" aria-hidden />
      עוד לא תועד
    </span>
  );
}

// Kept for potential future partial state
export function _PartialPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn-foreground">
      <CircleDot className="h-3 w-3" aria-hidden />
      חלקי
    </span>
  );
}
