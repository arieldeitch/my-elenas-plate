import { Check, ChevronLeft, Dumbbell, Footprints, Minus, Timer } from "lucide-react";
import { useMemo } from "react";
import { MEAL_SLOTS, partnerOf, type ProfileId } from "@/lib/domain";
import { MEAL_LABELS } from "@/lib/meal-slots";
import { calcCompletion } from "@/lib/completion";
import { latestActivity } from "@/lib/activity";
import { useStore, PROFILES } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatPoints, pointsForDay } from "@/lib/points";

/**
 * M2 — the partner's day at a glance, for the same selected date, without
 * switching profiles: name, documented count, six slot-status dots, the last
 * thing they logged, and — only when the data exists — a fasting window and a
 * workout mark. No calories / macros: the product deliberately has none
 * (DEC-004) and the model stores none. Tapping opens the partner's Day Review
 * (M2-4) when the home provides `onOpen`; otherwise it switches profiles.
 */
interface Props {
  /** M2-4: open the partner's Day Review (read-only). Without it the tap switches profiles. */
  onOpen?: (partner: ProfileId) => void;
}

export function PartnerGlance({ onOpen }: Props = {}) {
  const { activeProfile, setActiveProfile, selectedDate, getDay, foods, getPointsBudget } = useStore();
  const partnerId = partnerOf(activeProfile);
  const partner = PROFILES.find((p) => p.id === partnerId)!;
  const iso = toISODate(selectedDate);
  const day = getDay(partnerId, iso);
  const completion = useMemo(() => calcCompletion(day.meals), [day.meals]);
  const latest = useMemo(() => latestActivity(day), [day]);

  const feminine = partnerId === "elena";
  const summary =
    completion.state === "full"
      ? feminine
        ? "סיימה לתעד את היום"
        : "סיים לתעד את היום"
      : completion.state === "empty"
        ? feminine
          ? "עוד לא תיעדה היום"
          : "עוד לא תיעד היום"
        : `${completion.documented} מתוך ${completion.total} ארוחות תועדו`;
  const latestText = latest
    ? `לאחרונה: ${latest.entry.foodName} · ${MEAL_LABELS[latest.slot]}${latest.time ? ` · ${latest.time}` : ""}`
    : null;
  const workout = day.workout?.performed ? (day.workout.type ?? "אימון") : null;
  const fasting = day.fasting ? `${day.fasting.start}–${day.fasting.end}` : null;
  const partnerPoints = pointsForDay(day, foods);
  const partnerBudget = getPointsBudget(partnerId);
  const steps =
    day.steps?.steps != null
      ? day.steps.steps.toLocaleString("he-IL")
      : day.steps?.completed
        ? "בוצע"
        : null;

  return (
    <button
      type="button"
      onClick={() => (onOpen ? onOpen(partnerId) : setActiveProfile(partnerId))}
      data-testid="partner-glance"
      data-partner={partnerId}
      aria-label={`${partner.name}: ${summary}${latestText ? `. ${latestText}` : ""}. ${
        onOpen ? `סקירת היום של ${partner.name}` : `מעבר לפרופיל של ${partner.name}`
      }`}
      className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-right shadow-soft transition-all duration-200 hover:shadow-[0_4px_14px_rgba(20,40,70,0.06)] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: partner.color }}
        aria-hidden
      >
        {partner.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-foreground">{partner.name}</span>
          <span className="flex items-center gap-1" aria-hidden>
            {MEAL_SLOTS.map((slot) => {
              const status = day.meals[slot].status;
              return (
                <span
                  key={slot}
                  title={MEAL_LABELS[slot]}
                  data-slot={slot}
                  data-status={status}
                  className={cn(
                    "grid h-3.5 w-3.5 place-items-center rounded-full",
                    status === "logged"
                      ? "bg-primary text-white"
                      : status === "skipped"
                        ? "bg-[#94A3B4] text-white"
                        : "border border-border bg-secondary",
                  )}
                >
                  {status === "logged" && <Check className="h-2 w-2" strokeWidth={4} />}
                  {status === "skipped" && <Minus className="h-2 w-2" strokeWidth={4} />}
                </span>
              );
            })}
          </span>
          <span className="text-[11px] font-semibold text-primary tabular-nums" data-testid="partner-points">
            {formatPoints(partnerPoints)}/{formatPoints(partnerBudget)} נק׳
          </span>
          {(workout || fasting || steps) && (
            <span
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              aria-hidden
            >
              {workout && (
                <span className="inline-flex items-center gap-0.5" data-testid="partner-workout">
                  <Dumbbell className="h-3 w-3" />
                </span>
              )}
              {steps && (
                <span
                  className="inline-flex items-center gap-0.5 tabular-nums"
                  data-testid="partner-steps"
                  title={`צעדים: ${steps}`}
                >
                  <Footprints className="h-3 w-3" />
                  {steps}
                </span>
              )}
              {fasting && (
                <span
                  className="inline-flex items-center gap-0.5 tabular-nums"
                  dir="ltr"
                  data-testid="partner-fasting"
                >
                  <Timer className="h-3 w-3" />
                  {fasting}
                </span>
              )}
            </span>
          )}
        </span>
        <span className="block truncate text-[12px] leading-snug text-muted-foreground">
          {latestText ?? summary}
        </span>
      </span>
      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
