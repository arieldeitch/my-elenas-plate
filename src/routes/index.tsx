import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { MEAL_SLOTS, type MealSlotId, type ProfileId } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { ProfileSwitcher } from "@/components/nutrition/ProfileSwitcher";
import { SyncStatus } from "@/components/nutrition/SyncStatus";
import { TodayCard } from "@/components/nutrition/TodayCard";
import { PartnerGlance } from "@/components/nutrition/PartnerGlance";
import { MealCard } from "@/components/nutrition/MealCard";
import { MealEditor } from "@/components/nutrition/MealEditor";
import { DailyContextRow } from "@/components/nutrition/DailyContextRow";
import { DayReview } from "@/components/nutrition/DayReview";
import { WeighInForm } from "@/components/nutrition/WeighInForm";
import { CalendarView } from "@/components/nutrition/CalendarView";
import { BottomNav } from "@/components/nutrition/BottomNav";
import { BrandMark } from "@/components/nutrition/BrandMark";
import { RuntimeModeNotice } from "@/components/nutrition/RuntimeModeNotice";
import { DeviceProfileChooser } from "@/components/nutrition/DeviceProfileChooser";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useKeyboardSafeViewport } from "@/lib/use-keyboard-safe-viewport";

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
  useKeyboardSafeViewport();
  const store = useStore();
  const [openSlot, setOpenSlot] = useState<MealSlotId | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [weighOpen, setWeighOpen] = useState(false);
  // M2-4 Day Review: which person's day is being reviewed (null = closed).
  const [reviewPerson, setReviewPerson] = useState<ProfileId | null>(null);

  // Stable handlers so background sync re-renders don't reset open modals.
  const closeSlot = useCallback(() => setOpenSlot(null), []);
  const closeCalendar = useCallback(() => setCalendarOpen(false), []);
  const closeWeigh = useCallback(() => setWeighOpen(false), []);
  const closeReview = useCallback(() => setReviewPerson(null), []);
  // Review → editor: the review only offers edits for the ACTIVE person, so the
  // editor opens on the same person and date; the review closes underneath.
  const editFromReview = useCallback((slot: MealSlotId) => {
    setReviewPerson(null);
    setOpenSlot(slot);
  }, []);

  const iso = toISODate(store.selectedDate);
  const day = store.getDay(store.activeProfile, iso);
  // The FAB logs into the first slot that still needs attention, never a fixed one.
  const nextSlot: MealSlotId = MEAL_SLOTS.find((s) => day.meals[s].status === "empty") ?? "lunch";

  return (
    <div className="min-h-screen bg-background pb-28">
      <main className="mx-auto max-w-[820px] px-5 pt-5 sm:pt-6">
        <h1 className="sr-only">בריאותי — מעקב תזונה משותף</h1>
        {/* Header: who is logging (switcher + device default) · brand + sync, one block.
            min-w-0 + shrink-0 keep the brand column inside a 360px viewport. */}
        <header className="mb-3 flex min-w-0 items-start justify-between gap-2">
          <ProfileSwitcher />
          <div className="flex shrink-0 flex-col items-end gap-1">
            <BrandMark />
            <SyncStatus />
          </div>
        </header>

        {/* M2 hierarchy: ME (today card) → PARTNER (glance) → ACTION (the six slots) → context row. */}
        <TodayCard
          onOpenCalendar={() => setCalendarOpen(true)}
          onOpenReview={() => setReviewPerson(store.activeProfile)}
        />
        <PartnerGlance onOpen={setReviewPerson} />

        {/* Meals — the action: tap a slot to log into it */}
        <section className="mt-4" data-testid="meal-tiles">
          <h2 className="mb-2 px-1 text-[14px] font-semibold text-foreground text-right">
            ארוחות היום
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {MEAL_SLOTS.map((slot) => (
              <MealCard key={slot} meal={day.meals[slot]} onOpen={() => setOpenSlot(slot)} />
            ))}
          </div>
        </section>

        {/* Secondary daily context — compact, unfolds on demand (M2-3) */}
        <DailyContextRow onOpenWeight={() => setWeighOpen(true)} />

        <RuntimeModeNotice />
      </main>

      <DeviceProfileChooser />
      <MealEditor slot={openSlot} onClose={closeSlot} />
      <CalendarView open={calendarOpen} onClose={closeCalendar} />
      <WeighInForm open={weighOpen} onClose={closeWeigh} />
      <DayReview person={reviewPerson} onClose={closeReview} onEditSlot={editFromReview} />
      <BottomNav
        active={calendarOpen ? "calendar" : "home"}
        onHome={() => setCalendarOpen(false)}
        onCalendar={() => setCalendarOpen(true)}
        onAdd={() => setOpenSlot(nextSlot)}
      />
    </div>
  );
}
