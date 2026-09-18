import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { MEAL_SLOTS, type MealSlotId } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { ProfileSwitcher } from "@/components/nutrition/ProfileSwitcher";
import { SyncStatus } from "@/components/nutrition/SyncStatus";
import { TodayCard } from "@/components/nutrition/TodayCard";
import { PartnerGlance } from "@/components/nutrition/PartnerGlance";
import { MealCard } from "@/components/nutrition/MealCard";
import { MealEditor } from "@/components/nutrition/MealEditor";
import { FastingCard } from "@/components/nutrition/FastingCard";
import { WorkoutCard } from "@/components/nutrition/WorkoutCard";
import { WeightBanner } from "@/components/nutrition/WeightBanner";
import { WeighInForm } from "@/components/nutrition/WeighInForm";
import { CalendarView } from "@/components/nutrition/CalendarView";
import { BottomNav } from "@/components/nutrition/BottomNav";
import { BrandMark } from "@/components/nutrition/BrandMark";
import { RuntimeModeNotice } from "@/components/nutrition/RuntimeModeNotice";
import { DeviceProfileChooser } from "@/components/nutrition/DeviceProfileChooser";
import { isSupabaseConfigured } from "@/lib/supabase/client";

// The page title must not claim "demo" when the build is a connected cloud build.
const TITLE = isSupabaseConfigured() ? "מעקב תזונה משותף" : "מעקב תזונה משותף — גרסת הדגמה";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: "אפליקציית תיעוד תזונה משותפת עם ממשק פשוט, מהיר ורגוע." },
      { property: "og:title", content: TITLE },
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

  // Stable handlers so background sync re-renders don't reset open modals.
  const closeSlot = useCallback(() => setOpenSlot(null), []);
  const closeCalendar = useCallback(() => setCalendarOpen(false), []);
  const closeWeigh = useCallback(() => setWeighOpen(false), []);

  const iso = toISODate(store.selectedDate);
  const day = store.getDay(store.activeProfile, iso);
  // The FAB logs into the first slot that still needs attention, never a fixed one.
  const nextSlot: MealSlotId = MEAL_SLOTS.find((s) => day.meals[s].status === "empty") ?? "lunch";

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="mx-auto max-w-[820px] px-5 pt-5 sm:pt-6">
        {/* Header: profile switcher + brand */}
        <header className="mb-3 flex items-center justify-between gap-3">
          <ProfileSwitcher />
          <BrandMark />
        </header>

        {/* M2 hierarchy: ME (today card) → PARTNER (glance) → ACTION (the six slots). */}
        <div className="mb-2 flex justify-end">
          <SyncStatus />
        </div>
        <TodayCard onOpenCalendar={() => setCalendarOpen(true)} />
        <PartnerGlance />

        {/* Meals — the action: tap a slot to log into it */}
        <section className="mt-4">
          <h2 className="mb-2 px-1 text-[14px] font-semibold text-foreground text-right">
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

        <RuntimeModeNotice />
      </div>

      <DeviceProfileChooser />
      <MealEditor slot={openSlot} onClose={closeSlot} />
      <CalendarView open={calendarOpen} onClose={closeCalendar} />
      <WeighInForm open={weighOpen} onClose={closeWeigh} />
      <WeightBanner onOpen={() => setWeighOpen(true)} />
      <BottomNav
        active="home"
        onCalendar={() => setCalendarOpen(true)}
        onAdd={() => setOpenSlot(nextSlot)}
        onHistory={() => setCalendarOpen(true)}
      />
    </div>
  );
}
