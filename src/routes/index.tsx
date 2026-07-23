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
    <div className="min-h-screen bg-background pb-36">
      <div className="mx-auto max-w-[820px] px-6 pt-5 sm:pt-7">
        {/* Header */}
        <header className="mb-5 flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-[#708197]">מעקב תזונה</div>
          <SyncStatus />
        </header>

        {/* Profile switcher */}
        <div className="mb-5 flex justify-center">
          <ProfileSwitcher />
        </div>

        {/* Date */}
        <DateNavigator onOpenCalendar={() => setCalendarOpen(true)} />

        {/* Completion */}
        <div className="mt-5">
          <DailyCompletionIndicator info={completion} />
        </div>

        {/* Meals */}
        <section className="mt-5">
          <h2 className="mb-3 px-1 text-[15px] font-semibold text-foreground">ארוחות היום</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {MEAL_SLOTS.map((slot) => (
              <MealCard
                key={slot}
                meal={day.meals[slot]}
                onOpen={() => setOpenSlot(slot)}
              />
            ))}
          </div>
        </section>


        {/* Secondary */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FastingCard />
          <WorkoutCard />
        </div>

        <p className="mt-8 text-center text-[11px] text-[#94A3B4]">
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
