import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MEAL_SLOTS, type MealSlotId } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { calcCompletion } from "@/lib/completion";
import { ProfileSwitcher } from "@/components/nutrition/ProfileSwitcher";
import { DateNavigator } from "@/components/nutrition/DateNavigator";
import { SyncStatus } from "@/components/nutrition/SyncStatus";
import { DailyCompletionIndicator } from "@/components/nutrition/DailyCompletionIndicator";
import { MealCard } from "@/components/nutrition/MealCard";
import { MealEditor } from "@/components/nutrition/MealEditor";
import { FastingCard } from "@/components/nutrition/FastingCard";
import { WorkoutCard } from "@/components/nutrition/WorkoutCard";
import { WeightBanner } from "@/components/nutrition/WeightBanner";
import { WeighInForm } from "@/components/nutrition/WeighInForm";
import { CalendarView } from "@/components/nutrition/CalendarView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "מעקב תזונה משותף — גרסת הדגמה" },
      { name: "description", content: "אפליקציית תיעוד תזונה משותפת עם ממשק פשוט, מהיר ורגוע." },
      { property: "og:title", content: "מעקב תזונה משותף" },
      { property: "og:description", content: "תיעוד ארוחות, צום, אימון ושקילות בקצב שלכם." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const store = useStore();
  const [openSlot, setOpenSlot] = useState<MealSlotId | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [weighOpen, setWeighOpen] = useState(false);

  const iso = toISODate(store.selectedDate);
  const day = store.getDay(store.activeProfile, iso);
  const completion = useMemo(() => calcCompletion(day.meals), [day.meals]);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto max-w-2xl px-4 pt-4 sm:pt-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-sm font-semibold text-muted-foreground">מעקב תזונה</div>
          <div className="flex items-center gap-2">
            <span
              className="hidden sm:inline text-[10px] uppercase tracking-wide font-medium text-muted-foreground bg-secondary rounded-full px-2 py-0.5"
              title="גרסת הדגמה — הנתונים נשמרים באופן זמני בדפדפן"
            >
              גרסת הדגמה
            </span>
            <SyncStatus />
          </div>
        </div>

        <div className="flex justify-center mb-3">
          <ProfileSwitcher />
        </div>
        <span className="sm:hidden mx-auto mb-3 block text-center text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
          גרסת הדגמה
        </span>

        <DateNavigator onOpenCalendar={() => setCalendarOpen(true)} />

        <div className="mt-4">
          <DailyCompletionIndicator info={completion} />
        </div>

        {/* Meals matrix */}
        <div className="mt-5 rounded-3xl bg-card border border-border p-4 sm:p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">ארוחות היום</h2>
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-y-5 gap-x-1">
            {MEAL_SLOTS.map((slot) => (
              <MealCard
                key={slot}
                meal={day.meals[slot]}
                onOpen={() => setOpenSlot(slot)}
              />
            ))}
          </div>
        </div>

        {/* Secondary sections */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <FastingCard />
          <WorkoutCard />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          הנתונים בגרסת ההדגמה נשמרים באופן זמני בדפדפן בלבד.
        </p>
      </div>

      <MealEditor slot={openSlot} onClose={() => setOpenSlot(null)} />
      <CalendarView open={calendarOpen} onClose={() => setCalendarOpen(false)} />
      <WeighInForm open={weighOpen} onClose={() => setWeighOpen(false)} />
      <WeightBanner onOpen={() => setWeighOpen(true)} />
    </div>
  );
}
