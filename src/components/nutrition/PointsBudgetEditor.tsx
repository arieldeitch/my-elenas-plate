import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useStore, PROFILES } from "@/lib/store";

export function PointsBudgetEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeProfile, dailyPointsBudgets, setDailyPointsBudget } = useStore();
  const [value, setValue] = useState(String(dailyPointsBudgets[activeProfile]));
  const profile = PROFILES.find((item) => item.id === activeProfile);
  useEffect(
    () => setValue(String(dailyPointsBudgets[activeProfile])),
    [activeProfile, dailyPointsBudgets],
  );
  if (!open || !profile) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="תקציב נקודות יומי"
    >
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} aria-hidden />
      <form
        className="keyboard-safe-sheet relative flex w-full max-w-md flex-col rounded-t-3xl border border-border bg-card p-4 shadow-lg sm:rounded-3xl"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed > 0) {
            setDailyPointsBudget(parsed);
            onClose();
          }
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <h2 className="font-bold">תקציב נקודות יומי</h2>
            <p className="text-sm text-muted-foreground">התקציב הנוכחי של {profile.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <label htmlFor="points-budget" className="mt-4 text-sm font-medium">
          נקודות ליום
        </label>
        <input
          id="points-budget"
          autoFocus
          type="number"
          inputMode="numeric"
          min="1"
          max="200"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="mt-1 rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="mt-4 min-h-12 rounded-2xl bg-primary px-4 font-semibold text-primary-foreground"
        >
          שמירה
        </button>
      </form>
    </div>
  );
}
