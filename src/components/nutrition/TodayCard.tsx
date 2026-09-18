import { useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { useStore, PROFILES } from "@/lib/store";
import { addDays, formatShortDate, isSameDay, toISODate } from "@/lib/format";
import { calcCompletion } from "@/lib/completion";
import { latestActivity } from "@/lib/activity";
import { MEAL_LABELS } from "@/lib/meal-slots";
import { cn } from "@/lib/utils";

interface Props {
  onOpenCalendar: () => void;
  /** M2-4: open the Day Review for this person and date. */
  onOpenReview?: () => void;
}

/**
 * M2 home — the "ME" block, one card: whose day (name + personal colour),
 * which day (with prev / next / calendar), how it is going (documented slots
 * + bar) and the last thing logged. Replaces the separate date card and the
 * large completion card; the identity line is what makes "am I logging for
 * me or for my partner?" answerable at a glance.
 *
 * M2-4: the progress + "לאחרונה" rows are one tap target that opens the Day
 * Review ("what exactly did I eat today?") — no extra button on the home.
 */
export function TodayCard({ onOpenCalendar, onOpenReview }: Props) {
  const { activeProfile, selectedDate, setSelectedDate, getDay } = useStore();
  const profile = PROFILES.find((p) => p.id === activeProfile)!;
  const isToday = isSameDay(selectedDate, new Date());
  const day = getDay(activeProfile, toISODate(selectedDate));
  const completion = useMemo(() => calcCompletion(day.meals), [day.meals]);
  const latest = useMemo(() => latestActivity(day), [day]);
  const pct = (completion.documented / completion.total) * 100;
  const barColor =
    completion.state === "full"
      ? "bg-primary"
      : completion.state === "partial"
        ? "bg-info"
        : "bg-[#CBD5E0]";
  const reviewLabel = `מה ${profile.id === "elena" ? "אכלה אלנה" : "אכל אריאל"} היום: ${completion.documented} מתוך ${completion.total} ארוחות תועדו. פתיחת סקירת היום`;

  return (
    <section
      aria-label={`היום של ${profile.name}`}
      data-testid="today-card"
      data-owner={profile.id}
      className="rounded-2xl bg-white border border-[#E9EEF3] p-4 shadow-soft"
      style={{ borderInlineStartColor: profile.color, borderInlineStartWidth: 4 }}
    >
      {/* Row 1: who + which day */}
      <div className="flex items-center gap-2">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: profile.color }}
          aria-hidden
        >
          {profile.initials}
        </span>
        <div className="min-w-0 flex-1 text-right">
          <div className="text-[15px] font-bold text-foreground leading-tight">
            {profile.name}
            <span className="font-medium text-[#708197]"> · {isToday ? "היום" : "תאריך"}</span>
          </div>
          <div className="text-[12px] text-[#708197] leading-tight tabular-nums">
            {formatShortDate(selectedDate)}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            aria-label="יום קודם"
            className="grid h-10 w-10 place-items-center rounded-xl text-[#708197] hover:bg-[#F1F5F9] transition-colors"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <button
            onClick={onOpenCalendar}
            aria-label="פתיחת לוח שנה"
            className="grid h-10 w-10 place-items-center rounded-xl text-[#2B84D6] hover:bg-[#EDF6FD] transition-colors"
          >
            <Calendar className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            aria-label="יום הבא"
            className="grid h-10 w-10 place-items-center rounded-xl text-[#708197] hover:bg-[#F1F5F9] transition-colors"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Rows 2–3: progress + latest — ONE tap target that opens the Day Review */}
      <button
        type="button"
        onClick={onOpenReview}
        disabled={!onOpenReview}
        data-testid="today-review"
        aria-label={reviewLabel}
        className="-mx-2 mt-2 block w-[calc(100%+16px)] rounded-xl px-2 py-1.5 text-right transition-colors hover:bg-[#F8FAFC] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
      >
        <div className="flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF2F6]"
            role="progressbar"
            aria-valuenow={completion.documented}
            aria-valuemin={0}
            aria-valuemax={completion.total}
            aria-label="התקדמות תיעוד יומי"
          >
            <div
              className={cn("h-full rounded-full transition-all duration-300 ease-out", barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div
            className="shrink-0 text-[13px] text-[#708197] tabular-nums"
            data-testid="today-count"
          >
            <span className="text-[17px] font-extrabold text-foreground">
              {completion.documented}
            </span>
            <span>/{completion.total} ארוחות</span>
          </div>
        </div>

        <p className="mt-1.5 flex items-center gap-2 text-[12px] text-[#708197]">
          <span className="min-w-0 flex-1 truncate" data-testid="today-latest">
            {latest ? (
              <>
                <span className="text-foreground">לאחרונה:</span> {latest.entry.foodName} ·{" "}
                {MEAL_LABELS[latest.slot]}
                {latest.time ? ` · ${latest.time}` : ""}
              </>
            ) : completion.state === "empty" ? (
              "עוד לא תועד היום — הקשה על ארוחה מתעדת אותה."
            ) : (
              completion.label
            )}
          </span>
          {onOpenReview && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 font-medium text-[#2B84D6]"
              aria-hidden
            >
              <ListChecks className="h-3.5 w-3.5" />
              כל היום
            </span>
          )}
        </p>
      </button>
    </section>
  );
}
