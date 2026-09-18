import { Check, ChevronLeft, Minus } from "lucide-react";
import { useMemo } from "react";
import { MEAL_SLOTS, partnerOf } from "@/lib/domain";
import { MEAL_LABELS } from "@/lib/meal-slots";
import { calcCompletion } from "@/lib/completion";
import { useStore, PROFILES } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * M2 — couple-first home (first step): the partner's day at a glance, for the
 * same selected date, without switching profiles. Shows only slot STATUS
 * (documented / skipped / empty) — never food details, per the home-screen
 * guardrail — plus the count. Tapping switches the active profile to the
 * partner so both people can see each other's day from either phone.
 *
 * Data: the store already holds both profiles' days; the sync hook hydrates
 * the partner's day for the viewed date and realtime keeps it fresh.
 */
export function PartnerGlance() {
  const { activeProfile, setActiveProfile, selectedDate, getDay } = useStore();
  const partnerId = partnerOf(activeProfile);
  const partner = PROFILES.find((p) => p.id === partnerId)!;
  const partnerIndex = PROFILES.findIndex((p) => p.id === partnerId);
  const color = partnerIndex === 0 ? "#17A668" : "#2B84D6";
  const iso = toISODate(selectedDate);
  const day = getDay(partnerId, iso);
  const completion = useMemo(() => calcCompletion(day.meals), [day.meals]);

  const summary =
    completion.state === "full"
      ? "סיימה לתעד את היום"
      : completion.state === "empty"
        ? "עוד לא תיעדה היום"
        : `${completion.documented} מתוך ${completion.total} ארוחות תועדו`;
  // אריאל is grammatically masculine in Hebrew; אלנה feminine.
  const text =
    partnerId === "me" ? summary.replace("תיעדה", "תיעד").replace("סיימה", "סיים") : summary;

  return (
    <button
      type="button"
      onClick={() => setActiveProfile(partnerId)}
      data-testid="partner-glance"
      data-partner={partnerId}
      aria-label={`${partner.name}: ${text}. מעבר לפרופיל של ${partner.name}`}
      className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-[#E9EEF3] bg-white px-4 py-3 text-right shadow-soft transition-all duration-200 hover:shadow-[0_4px_14px_rgba(20,40,70,0.06)] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {partner.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-foreground">{partner.name}</span>
        <span className="block text-[12px] leading-snug text-[#708197]">{text}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1" aria-hidden>
        {MEAL_SLOTS.map((slot) => {
          const status = day.meals[slot].status;
          return (
            <span
              key={slot}
              title={MEAL_LABELS[slot]}
              data-slot={slot}
              data-status={status}
              className={cn(
                "grid h-4 w-4 place-items-center rounded-full",
                status === "logged"
                  ? "bg-primary text-white"
                  : status === "skipped"
                    ? "bg-[#94A3B4] text-white"
                    : "border border-[#D5DEE8] bg-[#F5F8FB]",
              )}
            >
              {status === "logged" && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
              {status === "skipped" && <Minus className="h-2.5 w-2.5" strokeWidth={3.5} />}
            </span>
          );
        })}
      </span>
      <ChevronLeft className="h-4 w-4 shrink-0 text-[#94A3B4]" aria-hidden />
    </button>
  );
}
