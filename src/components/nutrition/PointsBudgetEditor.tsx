import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";

export function PointsBudgetEditor({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const store = useStore();
  const budget = store.getPointsBudget(store.activeProfile);
  const [raw, setRaw] = useState(String(budget));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRaw(String(budget));
      setError(null);
    }
  }, [open, budget]);

  if (!open) return null;

  function save() {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      setError("התקציב חייב להיות מספר גדול מאפס.");
      return;
    }
    store.setPointsBudget(value);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="עריכת תקציב נקודות יומי"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        aria-label="סגירה"
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="keyboard-safe-sheet relative w-full max-w-md rounded-t-3xl border border-border bg-card p-5 shadow-lg sm:rounded-3xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-foreground">תקציב נקודות יומי</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              מודל נקודות פנימי ופשוט; ניתן לשנות את היעד.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label htmlFor="points-budget" className="mb-1 block text-sm font-medium">
          תקציב יומי
        </label>
        <input
          id="points-budget"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setError(null);
          }}
          className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={save}
          className="mt-4 min-h-12 w-full rounded-2xl bg-primary px-4 font-semibold text-primary-foreground"
        >
          שמירה
        </button>
      </div>
    </div>
  );
}
