import { Check, X } from "lucide-react";
import type { DailyMeal } from "@/lib/domain";
import { MEAL_ICONS, MEAL_LABELS, MEAL_TILE_TINT } from "@/lib/meal-slots";
import { cn } from "@/lib/utils";

interface Props {
  meal: DailyMeal;
  onOpen: () => void;
}

export function MealCard({ meal, onOpen }: Props) {
  const Icon = MEAL_ICONS[meal.slot];
  const label = MEAL_LABELS[meal.slot];
  const status = meal.status;
  const tint = MEAL_TILE_TINT[meal.slot];

  const statusText =
    status === "logged" ? "תועד" : status === "skipped" ? "לא נאכלה" : "לא תועד";

  const dimmed = status === "empty";

  return (
    <button
      onClick={onOpen}
      aria-label={`${label}: ${statusText}`}
      className="group flex w-full flex-col items-center gap-2 rounded-2xl p-2 text-center transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
    >
      <div className="relative">
        <div
          className={cn(
            "grid h-[68px] w-[68px] place-items-center rounded-full border-4 border-card shadow-soft",
            status === "skipped" ? "bg-muted text-muted-foreground" : tint,
            dimmed && "opacity-70 border-dashed border-border bg-muted/40 text-muted-foreground",
          )}
          aria-hidden
        >
          <Icon className="h-7 w-7" />
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="text-[13px] font-bold text-foreground leading-tight px-1">
        {label}
      </div>
      <StatusPill status={status} />
    </button>
  );
}

function StatusBadge({ status }: { status: DailyMeal["status"] }) {
  if (status === "logged") {
    return (
      <span
        aria-hidden
        className="absolute -top-1 -left-1 grid h-6 w-6 place-items-center rounded-full bg-success text-success-foreground border-2 border-card shadow-soft"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span
        aria-hidden
        className="absolute -top-1 -left-1 grid h-6 w-6 place-items-center rounded-full bg-fuchsia-400 text-white border-2 border-card shadow-soft"
      >
        <X className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="absolute -top-1 -left-1 h-6 w-6 rounded-full bg-card border-2 border-border"
    />
  );
}

function StatusPill({ status }: { status: DailyMeal["status"] }) {
  if (status === "logged") {
    return (
      <span className="rounded-full bg-success-soft px-3 py-0.5 text-[11px] font-bold text-success">
        תועד
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="rounded-full bg-fuchsia-50 px-3 py-0.5 text-[11px] font-bold text-fuchsia-600">
        לא נאכלה
      </span>
    );
  }
  return (
    <span className="rounded-full px-3 py-0.5 text-[11px] font-bold text-muted-foreground">
      לא תועד
    </span>
  );
}
