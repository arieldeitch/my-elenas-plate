import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Check, Minus, Pencil, X } from "lucide-react";
import type { FoodEntry, MealSlotId, ProfileId } from "@/lib/domain";
import { MEAL_SLOTS } from "@/lib/domain";
import { MEAL_ICONS, MEAL_LABELS, MEAL_TILE_TINT } from "@/lib/meal-slots";
import { useStore, PROFILES } from "@/lib/store";
import { formatShortDate, isSameDay, toISODate } from "@/lib/format";
import { calcCompletion } from "@/lib/completion";
import { countEntries } from "@/lib/activity";
import { coffeeSummary } from "@/lib/coffee";
import { formatQuantity } from "@/lib/quantity";
import { cn } from "@/lib/utils";
import { formatPoints, pointsForDay, pointsForEntry } from "@/lib/points";

interface Props {
  /** Which person's day to show first; null = closed. */
  person: ProfileId | null;
  onClose: () => void;
  /** Open the meal editor for one of MY slots (review closes first). */
  onEditSlot: (slot: MealSlotId) => void;
}

/**
 * M2-4 — Day Review: one calm sheet that answers "what exactly did I / my
 * partner eat today, in which slot, roughly when, and what was skipped?"
 * Rendered entirely from the store (both people's days for the selected date
 * are already hydrated by the home) — no reads of its own.
 *
 * Read-only by design. Edit shortcuts appear only for the person who is
 * currently ACTIVE (that is whose day the meal editor edits); the partner's
 * day is reviewed read-only, and switching to the partner to edit stays an
 * explicit, separate step (the shared account may edit both, DEC-017 — this
 * surface simply does not make it casual).
 */
export function DayReview({ person, onClose, onEditSlot }: Props) {
  const store = useStore();
  const [viewing, setViewing] = useState<ProfileId>(person ?? "me");
  const panelRef = useRef<HTMLDivElement>(null);

  // Follow the requested person whenever the sheet (re)opens.
  useEffect(() => {
    if (person) {
      setViewing(person);
      panelRef.current?.focus();
    }
  }, [person]);

  useEffect(() => {
    if (!person) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [person, onClose]);

  if (!person) return null;

  const iso = toISODate(store.selectedDate);
  const isToday = isSameDay(store.selectedDate, new Date());
  const profile = PROFILES.find((p) => p.id === viewing)!;
  const day = store.getDay(viewing, iso);
  const completion = calcCompletion(day.meals);
  const items = countEntries(day);
  const canEdit = viewing === store.activeProfile;
  const feminine = viewing === "elena";
  const dayPoints = pointsForDay(day, store.foods);
  const pointsBudget = store.getPointsBudget(viewing);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`סקירת היום של ${profile.name}`}
      data-testid="day-review"
      data-person={viewing}
      data-date={iso}
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
          "relative flex w-full max-w-lg flex-col bg-card border border-border shadow-lg outline-none",
          "rounded-t-3xl sm:rounded-3xl max-h-[92vh] sm:max-h-[85vh] sm:my-8",
          "animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200",
        )}
        style={{ borderTopColor: profile.color, borderTopWidth: 3 }}
      >
        {/* Header: whose day, which day, person toggle */}
        <div className="border-b border-border p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold text-foreground">
                {isToday ? "היום" : formatShortDate(store.selectedDate)}
                {!isToday && (
                  <span className="mr-1 text-[12px] font-medium text-muted-foreground">
                    · {dayName(store.selectedDate)}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-muted-foreground" data-testid="day-review-summary">
                {completion.documented}/{completion.total} ארוחות תועדו
                {items > 0 ? ` · ${items} ${items === 1 ? "פריט" : "פריטים"}` : ""}
                {` · ${formatPoints(dayPoints)}/${formatPoints(pointsBudget)} נק׳`}
                {isToday ? ` · ${formatShortDate(store.selectedDate)}` : ""}
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

          <div
            role="tablist"
            aria-label="של מי היום"
            className="mt-3 inline-flex rounded-full bg-[#EEF2F6] p-1"
          >
            {PROFILES.map((p) => {
              const active = p.id === viewing;
              const mine = p.id === store.activeProfile;
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setViewing(p.id)}
                  data-testid={`day-review-person-${p.id}`}
                  className={cn(
                    "flex min-w-[104px] items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active ? "bg-white text-foreground shadow-soft" : "text-muted-foreground",
                  )}
                >
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold text-white"
                    style={{ backgroundColor: p.color, opacity: active ? 1 : 0.55 }}
                    aria-hidden
                  >
                    {p.initials}
                  </span>
                  <span>{mine ? "שלי" : p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body: the six slots, in order, always all present */}
        <div className="flex-1 overflow-y-auto px-4 py-3" data-testid="day-review-list">
          {items === 0 && completion.documented === 0 && (
            <p className="mb-2 text-[13px] text-muted-foreground">
              {canEdit
                ? "עוד לא תועד כלום ליום הזה — הקשה על ארוחה במסך הבית מתעדת אותה."
                : feminine
                  ? "אלנה עוד לא תיעדה כלום ליום הזה."
                  : "אריאל עוד לא תיעד כלום ליום הזה."}
            </p>
          )}
          <ul className="space-y-1.5">
            {MEAL_SLOTS.map((slot) => (
              <SlotRow
                key={slot}
                slot={slot}
                status={day.meals[slot].status}
                entries={day.meals[slot].entries}
                canEdit={canEdit}
                onEdit={() => onEditSlot(slot)}
              />
            ))}
          </ul>
        </div>

        {/* Footer: only when reviewing the other person — switching to edit is deliberate */}
        {!canEdit && (
          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={() => {
                store.setActiveProfile(viewing);
                onClose();
              }}
              data-testid="day-review-switch"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              מעבר לפרופיל של {profile.name} (לעריכה)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  status,
  entries,
  canEdit,
  onEdit,
}: {
  slot: MealSlotId;
  status: "empty" | "logged" | "skipped";
  entries: FoodEntry[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  const { foods } = useStore();
  const Icon = MEAL_ICONS[slot];
  const label = MEAL_LABELS[slot];
  const stateText = status === "skipped" ? "לא נאכלה ארוחה" : status === "empty" ? "לא תועד" : "";
  return (
    <li
      data-testid={`day-review-slot-${slot}`}
      data-status={status}
      className={cn(
        "rounded-2xl border px-3 py-2",
        status === "logged" ? "border-[#E9EEF3] bg-white" : "border-transparent bg-[#F5F8FB]",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full",
            status === "logged" ? MEAL_TILE_TINT[slot] : "bg-[#EEF2F6] text-muted-foreground",
          )}
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">{label}</span>
        {status !== "logged" && (
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            {status === "skipped" && <Minus className="h-3 w-3" aria-hidden />}
            {stateText}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`עריכת ${label}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-[#F1F5F9]"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
      {entries.length > 0 && (
        <ul className="mt-1.5 space-y-1 pr-9">
          {entries.map((e) => (
            <li key={e.id} className="flex items-baseline gap-2 text-[13px] leading-snug">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-foreground">{e.foodName}</span>
              <span className="shrink-0 text-[12px] text-muted-foreground">{entryDetail(e)}</span>
              <span className="shrink-0 text-[11px] font-medium text-primary">
                {formatPoints(
                  pointsForEntry(
                    e,
                    foods.find((f) => f.id === e.foodId),
                  ),
                )}{" "}
                נק׳
              </span>
              {timeOf(e) && (
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums" dir="ltr">
                  {timeOf(e)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function entryDetail(e: FoodEntry): string {
  const qty = formatQuantity(e);
  return e.coffee ? [coffeeSummary(e.coffee), qty].filter(Boolean).join(" · ") : qty;
}

/** "HH:mm" from a real loggedAt only — nothing is invented for older rows. */
function timeOf(e: FoodEntry): string | null {
  if (!e.loggedAt) return null;
  const ts = Date.parse(e.loggedAt);
  if (!Number.isFinite(ts)) return null;
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
function dayName(d: Date): string {
  return `יום ${HE_DAYS[d.getDay()]}`;
}
