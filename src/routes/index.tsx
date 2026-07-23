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
import { BottomNav } from "@/components/nutrition/BottomNav";
import { BrandMark } from "@/components/nutrition/BrandMark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "מעקב תזונה משותף — גרסת הדגמה" },
      { name: "description", content: "אפליקציית תיעוד תזונה משותפת עם ממשק פשוט, מהיר ורגוע." },
      { property: "og:title", content: "מעקב תזונה משותף — גרסת הדגמה" },
      {
        property: "og:description",
        content: "אפליקציית תיעוד תזונה משותפת עם ממשק פשוט, מהיר ורגוע.",
      },
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
    <div className="min-h-screen bg-background pb-40">
      <div className="mx-auto max-w-[820px] px-5 pt-5 sm:pt-6">
        {/* Header: profile switcher + brand */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <ProfileSwitcher />
          <BrandMark />
        </header>

        <div className="mb-3 flex justify-end">
          <SyncStatus />
        </div>

        {/* Date */}
        <DateNavigator onOpenCalendar={() => setCalendarOpen(true)} />

        {/* Completion */}
        <div className="mt-4">
          <DailyCompletionIndicator info={completion} />
        </div>

        {/* Meals */}
        <section className="mt-5">
          <h2 className="mb-3 px-1 text-[15px] font-semibold text-foreground text-right">
            ארוחות היום
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {MEAL_SLOTS.map((slot) => (
              <MealCard key={slot} meal={day.meals[slot]} onOpen={() => setOpenSlot(slot)} />
            ))}
          </div>
        </section>

        {/* Secondary */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <WorkoutCard />
          <FastingCard />
        </div>

        <p className="mt-8 text-center text-xs text-[#94A3B4]">
          הנתונים בגרסת ההדגמה נשמרים באופן זמני בדפדפן בלבד.
        </p>
      </div>

      <MealEditor slot={openSlot} onClose={() => setOpenSlot(null)} />
      <CalendarView open={calendarOpen} onClose={() => setCalendarOpen(false)} />
      <WeighInForm open={weighOpen} onClose={() => setWeighOpen(false)} />
      <WeightBanner onOpen={() => setWeighOpen(true)} />
      <BottomNav
        active="home"
        onCalendar={() => setCalendarOpen(true)}
        onAdd={() => setOpenSlot("lunch")}
        onHistory={() => setCalendarOpen(true)}
      />
    </div>
  );
}
