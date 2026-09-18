import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { FastingLog } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { calcFastingHours as calcHours } from "@/lib/fasting";

interface Props {
  /** Called after save / clear so the row can fold the panel. */
  onDone: () => void;
}

/**
 * Inline editor for the day's fasting window (M2-3): two time inputs, the
 * computed duration, save / clear. Same data and midnight rule as the former
 * FastingCard; the read-only summary now lives in the daily context row.
 */
export function FastingEditor({ onDone }: Props) {
  const store = useStore();
  const day = store.getDay(store.activeProfile, toISODate(store.selectedDate));
  const [start, setStart] = useState(day.fasting?.start ?? "20:00");
  const [end, setEnd] = useState(day.fasting?.end ?? "12:00");

  function save() {
    const f: FastingLog = { start, end };
    store.setFasting(f);
    onDone();
  }
  function clear() {
    store.setFasting(undefined);
    onDone();
  }

  return (
    <div className="space-y-3" data-testid="fasting-editor">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="fstart">
            תחילת הצום
          </label>
          <input
            id="fstart"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="fend">
            סיום הצום
          </label>
          <input
            id="fend"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="text-sm text-muted-foreground">משך הצום: {calcHours(start, end)} שעות</div>
      <div className="flex gap-2">
        <button
          onClick={save}
          className="flex-1 rounded-2xl bg-primary py-2.5 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          שמירה
        </button>
        {day.fasting && (
          <button
            onClick={clear}
            className="rounded-2xl border border-border bg-card px-3 py-2.5 text-sm font-medium hover:bg-muted inline-flex items-center gap-1"
          >
            <RotateCcw className="h-4 w-4" /> ניקוי
          </button>
        )}
      </div>
    </div>
  );
}
