import { useEffect, useState } from "react";
import { Check, Footprints, Save } from "lucide-react";
import { useStore } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  onDone: () => void;
}

export function StepEditor({ onDone }: Props) {
  const store = useStore();
  const iso = toISODate(store.selectedDate);
  const existing = store.getDay(store.activeProfile, iso).steps;
  const currentGoal = existing?.goal ?? store.stepGoal;
  const [steps, setSteps] = useState(existing?.steps == null ? "" : String(existing.steps));
  const [goal, setGoal] = useState(String(currentGoal));
  const [editingGoal, setEditingGoal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSteps(existing?.steps == null ? "" : String(existing.steps));
    setGoal(String(existing?.goal ?? store.stepGoal));
    setError("");
  }, [existing?.steps, existing?.goal, store.stepGoal, iso, store.activeProfile]);

  function saveExact() {
    const value = Number(steps.replaceAll(",", ""));
    if (!Number.isInteger(value) || value < 0) return setError("יש להזין מספר צעדים תקין");
    store.setSteps({ steps: value, completed: value >= currentGoal, goal: currentGoal });
    onDone();
  }

  function saveCompleted() {
    store.setSteps({ completed: true, goal: currentGoal });
    onDone();
  }

  function saveGoal() {
    const value = Number(goal.replaceAll(",", ""));
    if (!Number.isInteger(value) || value <= 0) return setError("היעד חייב להיות מספר חיובי");
    store.setStepGoal(value);
    setEditingGoal(false);
    setError("");
  }

  return (
    <section aria-labelledby="steps-editor-title" className="context-editor">
      <div className="flex items-center gap-3">
        <span className="context-editor-icon bg-info-soft text-info">
          <Footprints className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="steps-editor-title" className="font-semibold">
            דיווח צעדים
          </h3>
          <p className="text-xs text-muted-foreground">
            ליום הנבחר · יעד {currentGoal.toLocaleString("he-IL")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditingGoal((v) => !v)}
          className="min-h-11 rounded-xl px-3 text-sm font-medium text-info hover:bg-info-soft"
        >
          עריכת יעד
        </button>
      </div>
      {editingGoal && (
        <div className="mt-3 flex items-end gap-2">
          <label className="min-w-0 flex-1 text-sm font-medium">
            יעד יומי
            <input
              aria-label="יעד צעדים יומי"
              inputMode="numeric"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="form-input mt-1"
            />
          </label>
          <button
            type="button"
            onClick={saveGoal}
            aria-label="שמירת יעד צעדים"
            className="icon-action bg-primary text-primary-foreground"
          >
            <Save className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-3">
          <label className="text-sm font-medium" htmlFor="daily-steps">
            מספר מדויק
          </label>
          <input
            id="daily-steps"
            inputMode="numeric"
            placeholder="למשל 8,734"
            value={steps}
            onChange={(e) => {
              setSteps(e.target.value);
              setError("");
            }}
            className="form-input mt-2"
          />
          <button
            type="button"
            onClick={saveExact}
            className="mt-2 min-h-11 w-full rounded-xl bg-primary px-3 font-semibold text-primary-foreground"
          >
            שמירת מספר
          </button>
        </div>
        <button
          type="button"
          onClick={saveCompleted}
          className={cn(
            "flex min-h-[132px] flex-col items-center justify-center rounded-2xl border border-info/30 bg-info-soft p-3 text-info",
            existing?.completed && "ring-2 ring-info",
          )}
        >
          <Check className="h-7 w-7" />
          <span className="mt-2 font-semibold">ביצעתי</span>
          <span className="text-xs">בלי להזין מספר</span>
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
