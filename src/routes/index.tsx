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

        {/* Meals */}
        <div className="mt-4 space-y-2.5">
          {MEAL_SLOTS.map((slot) => (
            <MealCard
              key={slot}
              meal={day.meals[slot]}
              onOpen={() => setOpenSlot(slot)}
            />
          ))}
        </div>

        {/* Secondary sections */}
        <div className="mt-6 space-y-3">
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
