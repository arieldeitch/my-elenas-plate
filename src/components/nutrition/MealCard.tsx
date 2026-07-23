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

  return (
    <button
      onClick={onOpen}
      aria-label={`${label}: ${statusText}`}
      className="group flex min-h-[150px] w-full flex-col items-center justify-between gap-3 rounded-3xl p-3 text-center transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
    >
      <div className="relative pt-1">
        <div
          className={cn(
            "grid h-16 w-16 place-items-center rounded-full transition-colors",
            status === "skipped" ? "bg-[#F1F5F9] text-[#708197]" : tint,
            status === "empty" && "opacity-90",
          )}
          aria-hidden
        >
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="text-[13px] font-semibold text-foreground leading-tight">
          {label}
        </div>
        <StatusPill status={status} />
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: DailyMeal["status"] }) {
  if (status === "logged") {
    return (
      <span
        aria-hidden
        className="absolute -top-0.5 -left-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-white ring-2 ring-white"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span
        aria-hidden
        className="absolute -top-0.5 -left-0.5 grid h-5 w-5 place-items-center rounded-full bg-[#708197] text-white ring-2 ring-white"
      >
        <X className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  return null;
}

function StatusPill({ status }: { status: DailyMeal["status"] }) {
  const base =
    "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium leading-none";
  if (status === "logged") {
    return <span className={cn(base, "bg-[#EDF8F2] text-[#17A668]")}>תועד</span>;
  }
  if (status === "skipped") {
    return <span className={cn(base, "bg-[#F1F5F9] text-[#708197]")}>לא נאכלה</span>;
  }
  return <span className={cn(base, "bg-transparent text-[#94A3B4]")}>לא תועד</span>;
}
