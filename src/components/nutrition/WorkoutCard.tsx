import { useState } from "react";
import { Dumbbell, Pencil, X } from "lucide-react";
import type { WorkoutFeeling, WorkoutLog, WorkoutType } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPES: WorkoutType[] = [
  "כוח", "אירובי", "הליכה", "ריצה", "אופניים", "שחייה", "יוגה / גמישות", "ספורט קבוצתי", "אחר",
];
const FEELINGS: WorkoutFeeling[] = ["קל", "טוב", "מאתגר", "קשה", "אחר"];

export function WorkoutCard() {
  const store = useStore();
  const day = store.getDay(store.activeProfile, toISODate(store.selectedDate));
  const workout = day.workout;
  const [editing, setEditing] = useState(false);

  function setPerformed(v: boolean) {
    if (v) {
      const next: WorkoutLog = {
        performed: true,
        type: workout?.type ?? "הליכה",
        feeling: workout?.feeling ?? "טוב",
      };
      store.setWorkout(next);
      setEditing(true);
    } else {
      store.setWorkout({ performed: false });
      setEditing(false);
    }
  }

  function updateType(t: WorkoutType) {
    store.setWorkout({ performed: true, type: t, feeling: workout?.feeling ?? "טוב" });
  }
  function updateFeeling(f: WorkoutFeeling) {
    store.setWorkout({ performed: true, type: workout?.type ?? "הליכה", feeling: f });
  }

  const isPerformed = workout?.performed === true;
  const isNot = workout?.performed === false;
  const isEmpty = !workout || workout.performed === null;

  return (
    <section
      aria-labelledby="workout-title"
      className="rounded-3xl bg-white border border-[#E9EEF3] p-6 shadow-soft"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[#EDF8F2] text-[#17A668]" aria-hidden>
          <Dumbbell className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h2 id="workout-title" className="text-[15px] font-semibold flex-1">אימון</h2>
        {isPerformed && !editing && (
          <button
            onClick={() => setEditing(true)}
            aria-label="עריכת אימון"
            className="grid h-10 w-10 place-items-center rounded-full text-[#708197] hover:bg-[#F1F5F9] transition-colors"
          >
            <Pencil className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="mt-3">
        <div className="text-sm text-muted-foreground mb-2">האם בוצע אימון?</div>
        <div className="inline-flex rounded-full bg-secondary p-1 border border-border">
          <ToggleBtn active={isPerformed} onClick={() => setPerformed(true)}>כן</ToggleBtn>
          <ToggleBtn active={isNot} onClick={() => setPerformed(false)}>לא</ToggleBtn>
          <ToggleBtn active={isEmpty} onClick={() => store.setWorkout(undefined)}>עוד לא תועד</ToggleBtn>
        </div>
      </div>

      {isPerformed && (
        <div className="mt-4 space-y-3">
          <ChipGroup label="סוג האימון" options={TYPES} value={workout?.type} onChange={updateType} />
          <ChipGroup label="תחושה" options={FEELINGS} value={workout?.feeling} onChange={updateFeeling} />
          {editing && (
            <div className="pt-1">
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                <X className="h-4 w-4" /> סיום
              </button>
            </div>
          )}
        </div>
      )}

      {isNot && (
        <p className="mt-3 text-sm text-muted-foreground">לא בוצע אימון היום.</p>
      )}
    </section>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium",
        active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ChipGroup<T extends string>({
  label, options, value, onChange,
}: { label: string; options: T[]; value?: T; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              value === o
                ? "border-primary bg-primary-soft text-primary font-medium"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
