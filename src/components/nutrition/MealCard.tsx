import { Check, Minus } from "lucide-react";
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

  const statusText = status === "logged" ? "תועד" : status === "skipped" ? "לא נאכלה" : "לא תועד";

  return (
    <button
      onClick={onOpen}
      aria-label={`${label}: ${statusText}`}
      className="group flex w-full flex-col items-center justify-start gap-2 rounded-[26px] border border-[#E5EBF2] bg-white p-3 pb-3.5 pt-4 text-center shadow-[0_1px_2px_rgba(20,40,70,0.04)] transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:shadow-[0_4px_14px_rgba(20,40,70,0.06)] active:scale-[0.98]"
    >
      <div className="relative">
        <div
          className={cn(
            "grid h-[92px] w-[92px] place-items-center rounded-full transition-colors",
            status === "skipped" ? "bg-[#F1F5F9] text-[#708197]" : tint,
          )}
          aria-hidden
        >
          <Icon className="h-[52px] w-[52px]" strokeWidth={1.6} />
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-1 text-[13px] font-semibold text-foreground leading-tight">{label}</div>
      <StatusPill status={status} />
    </button>
  );
}

function StatusBadge({ status }: { status: DailyMeal["status"] }) {
  if (status === "logged") {
    return (
      <span
        aria-hidden
        className="absolute -top-1.5 -left-1.5 grid h-7 w-7 place-items-center rounded-full bg-primary text-white ring-[3px] ring-white shadow-[0_2px_6px_rgba(23,166,104,0.35)]"
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span
        aria-hidden
        className="absolute -top-1.5 -left-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#94A3B4] text-white ring-[3px] ring-white shadow-sm"
      >
        <Minus className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }
  return null;
}

function StatusPill({ status }: { status: DailyMeal["status"] }) {
  const base =
    "inline-flex h-[22px] items-center rounded-full px-2.5 text-xs font-medium leading-none";
  if (status === "logged") {
    return <span className={cn(base, "bg-[#EDF8F2] text-[#17A668]")}>תועד</span>;
  }
  if (status === "skipped") {
    return <span className={cn(base, "bg-[#F1F5F9] text-[#708197]")}>לא נאכלה</span>;
  }
  return <span className={cn(base, "bg-transparent text-[#94A3B4]")}>לא תועד</span>;
}
