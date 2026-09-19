import { useEffect, useState } from "react";
import { Check, Save } from "lucide-react";
import { useStore } from "@/lib/store";
import { toISODate } from "@/lib/format";

/**
 * Daily steps editor. Works on the selected date (including past dates).
 * A numeric report stores the real count; "ביצעתי" records completion without
 * inventing a count. goalSteps is persisted with every daily row, so history
 * keeps the goal that applied that day and future empty days inherit the last
 * saved goal from Supabase.
 */
export function StepsEditor({ onDone }: { onDone: () => void }) {
  const store = useStore();
  const iso = toISODate(store.selectedDate);
  const log = store.getDay(store.activeProfile, iso).steps ?? {
    goalSteps: 10_000,
    completed: false,
  };

  const [goal, setGoal] = useState(String(log.goalSteps));
  const [count, setCount] = useState(log.steps == null ? "" : String(log.steps));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGoal(String(log.goalSteps));
    setCount(log.steps == null ? "" : String(log.steps));
    setError(null);
  }, [store.activeProfile, iso, log.goalSteps, log.steps]);

  function parsedGoal(): number | null {
    const n = Number(goal);
    if (!Number.isFinite(n) || n <= 0) {
      setError("היעד חייב להיות מספר גדול מאפס.");
      return null;
    }
    return Math.round(n);
  }

  function saveGoal() {
    const goalSteps = parsedGoal();
    if (goalSteps == null) return;
    store.setSteps({
      goalSteps,
      steps: log.steps,
      completed: log.steps == null ? log.completed : log.steps >= goalSteps,
    });
    setError(null);
  }

  function saveExact() {
    const goalSteps = parsedGoal();
    if (goalSteps == null) return;
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) {
      setError("יש להזין מספר צעדים תקין.");
      return;
    }
    const steps = Math.round(n);
    store.setSteps({ goalSteps, steps, completed: steps >= goalSteps });
    setError(null);
    onDone();
  }

  function markCompleted() {
    const goalSteps = parsedGoal();
    if (goalSteps == null) return;
    store.setSteps({ goalSteps, completed: true });
    setCount("");
    setError(null);
    onDone();
  }

  return (
    <div className="keyboard-safe-scroll max-h-[calc(var(--app-viewport-height)-12rem)] space-y-4 overflow-y-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]" data-testid="steps-editor">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="steps-goal">
          יעד יומי
        </label>
        <div className="flex gap-2">
          <input
            id="steps-goal"
            type="number"
            inputMode="numeric"
            min="1"
            step="100"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={saveGoal}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:bg-muted"
          >
            <Save className="h-4 w-4" aria-hidden />
            שמירת יעד
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="steps-count">
          מספר צעדים
        </label>
        <div className="flex gap-2">
          <input
            id="steps-count"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="לדוגמה 8734"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={saveExact}
            className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            שמירה
          </button>
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">או</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={markCompleted}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/35 bg-primary-soft font-semibold text-primary hover:border-primary/60"
      >
        <Check className="h-5 w-5" aria-hidden />
        ביצעתי את יעד הצעדים
      </button>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
