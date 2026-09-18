import type { WorkoutFeeling, WorkoutLog, WorkoutType } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPES: WorkoutType[] = [
  "כוח",
  "אירובי",
  "הליכה",
  "ריצה",
  "אופניים",
  "שחייה",
  "יוגה / גמישות",
  "ספורט קבוצתי",
  "אחר",
];
const FEELINGS: WorkoutFeeling[] = ["קל", "טוב", "מאתגר", "קשה", "אחר"];

/**
 * Inline editor for today's workout (M2-3): lives inside the daily context row,
 * opened only on demand. Same data and rules as the former WorkoutCard —
 * performed? → type + feeling; "לא" and "עוד לא תועד" are one tap.
 */
export function WorkoutEditor() {
  const store = useStore();
  const day = store.getDay(store.activeProfile, toISODate(store.selectedDate));
  const workout = day.workout;

  function setPerformed(v: boolean) {
    if (v) {
      const next: WorkoutLog = {
        performed: true,
        type: workout?.type ?? "הליכה",
        feeling: workout?.feeling ?? "טוב",
      };
      store.setWorkout(next);
    } else {
      store.setWorkout({ performed: false });
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
    <div data-testid="workout-editor">
      <div className="mb-2 text-sm text-muted-foreground">האם בוצע אימון?</div>
      <div className="inline-flex rounded-full bg-secondary p-1 border border-border">
        <ToggleBtn active={isPerformed} onClick={() => setPerformed(true)}>
          כן
        </ToggleBtn>
        <ToggleBtn active={isNot} onClick={() => setPerformed(false)}>
          לא
        </ToggleBtn>
        <ToggleBtn active={isEmpty} onClick={() => store.setWorkout(undefined)}>
          עוד לא תועד
        </ToggleBtn>
      </div>

      {isPerformed && (
        <div className="mt-3 space-y-3">
          <ChipGroup
            label="סוג האימון"
            options={TYPES}
            value={workout?.type}
            onChange={updateType}
          />
          <ChipGroup
            label="תחושה"
            options={FEELINGS}
            value={workout?.feeling}
            onChange={updateFeeling}
          />
        </div>
      )}
      {isNot && <p className="mt-3 text-sm text-muted-foreground">לא בוצע אימון היום.</p>}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full px-4 py-1.5 text-sm font-medium",
        active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value?: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "min-h-10 rounded-full border px-3 py-1.5 text-sm",
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
