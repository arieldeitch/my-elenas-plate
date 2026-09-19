import { useState } from "react";
import { Dumbbell, Footprints, Hourglass, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import { toISODate, formatNumber } from "@/lib/format";
import { calcFastingHours } from "@/lib/fasting";
import { latestAndPrevious } from "@/lib/weight";
import { FastingCard } from "./FastingCard";
import { WorkoutCard } from "./WorkoutCard";
import { StepEditor } from "./StepEditor";

type Editor = "fasting" | "workout" | "steps" | null;

export function DailyContext({ onOpenWeight }: { onOpenWeight: () => void }) {
  const store = useStore();
  const day = store.getDay(store.activeProfile, toISODate(store.selectedDate));
  const [editor, setEditor] = useState<Editor>(null);
  const latest = latestAndPrevious(store.weighIns).latest;
  const steps = day.steps;
  const tiles = [
    { key: "weight", label: "שקילה", value: latest ? `${formatNumber(latest.weightKg)} ק״ג` : "לא תועד", sub: latest ? "שקילה אחרונה" : "הוספת שקילה", icon: Scale, tone: "bg-primary-soft text-primary", action: onOpenWeight },
    { key: "workout", label: "אימון", value: day.workout?.performed === true ? (day.workout.type ?? "בוצע") : day.workout?.performed === false ? "לא בוצע" : "לא תועד", sub: "ליום הנבחר", icon: Dumbbell, tone: "bg-primary-soft text-primary", action: () => setEditor(editor === "workout" ? null : "workout") },
    { key: "fasting", label: "צום", value: day.fasting ? `${calcFastingHours(day.fasting.start, day.fasting.end)} שעות` : "לא תועד", sub: day.fasting ? `${day.fasting.start}–${day.fasting.end}` : "ליום הנבחר", icon: Hourglass, tone: "bg-info-soft text-info", action: () => setEditor(editor === "fasting" ? null : "fasting") },
    { key: "steps", label: "צעדים", value: steps?.steps != null ? steps.steps.toLocaleString("he-IL") : steps?.completed ? "בוצע" : "לא תועד", sub: `יעד ${(steps?.goal ?? store.stepGoal).toLocaleString("he-IL")}`, icon: Footprints, tone: "bg-info-soft text-info", action: () => setEditor(editor === "steps" ? null : "steps") },
  ];
  return (
    <section aria-labelledby="daily-context-title" className="mt-5">
      <h2 id="daily-context-title" className="mb-3 px-1 text-[15px] font-semibold">היום שלי</h2>
      <div className="daily-context-grid">
        {tiles.map(({ key, label, value, sub, icon: Icon, tone, action }) => (
          <button key={key} type="button" onClick={action} aria-expanded={key === editor} className="context-tile">
            <span className={`grid h-11 w-11 place-items-center rounded-full ${tone}`}><Icon className="h-5 w-5" /></span>
            <span className="mt-2 text-sm font-semibold">{label}</span><span className="mt-1 max-w-full truncate text-sm font-bold">{value}</span><span className="mt-0.5 max-w-full truncate text-[11px] text-muted-foreground">{sub}</span>
          </button>
        ))}
      </div>
      {editor === "workout" && <WorkoutCard onDone={() => setEditor(null)} />}
      {editor === "fasting" && <FastingCard onDone={() => setEditor(null)} />}
      {editor === "steps" && <StepEditor onDone={() => setEditor(null)} />}
    </section>
  );
}