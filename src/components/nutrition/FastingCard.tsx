import { useState } from "react";
import { Hourglass, Plus, X, Pencil, RotateCcw } from "lucide-react";
import type { FastingLog } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { calcFastingHours as calcHours } from "@/lib/fasting";

export function FastingCard() {
  const store = useStore();
  const day = store.getDay(store.activeProfile, toISODate(store.selectedDate));
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(day.fasting?.start ?? "20:00");
  const [end, setEnd] = useState(day.fasting?.end ?? "12:00");

  function open() {
    setStart(day.fasting?.start ?? "20:00");
    setEnd(day.fasting?.end ?? "12:00");
    setEditing(true);
  }

  function save() {
    const f: FastingLog = { start, end };
    store.setFasting(f);
    setEditing(false);
  }

  function clear() {
    store.setFasting(undefined);
    setEditing(false);
  }

  const hours = day.fasting ? calcHours(day.fasting.start, day.fasting.end) : null;

  return (
    <section
      aria-labelledby="fasting-title"
      className="rounded-3xl bg-white border border-[#E9EEF3] p-6 shadow-soft"
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 place-items-center rounded-full bg-[#EDF6FD] text-[#2B84D6]"
          aria-hidden
        >
          <Hourglass className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h2 id="fasting-title" className="text-[15px] font-semibold flex-1">
          צום
        </h2>
        {day.fasting && !editing && (
          <button
            onClick={open}
            aria-label="עריכת צום"
            className="grid h-10 w-10 place-items-center rounded-full text-[#708197] hover:bg-[#F1F5F9] transition-colors"
          >
            <Pencil className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {!editing && !day.fasting && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">לא תועד צום ליום זה</p>
          <button
            onClick={open}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-primary-soft px-3 py-2 text-sm font-medium text-primary hover:brightness-95"
          >
            <Plus className="h-4 w-4" /> הוספת שעות
          </button>
        </div>
      )}

      {!editing && day.fasting && hours !== null && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <Stat label="תחילת הצום" value={day.fasting.start} />
          <Stat label="סיום הצום" value={day.fasting.end} />
          <Stat label="משך הצום" value={`${hours} שעות`} highlight />
        </div>
      )}

      {editing && (
        <div className="mt-4 space-y-3">
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
          <div className="text-sm text-muted-foreground">
            משך הצום: {calcHours(start, end)} שעות
          </div>
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
            <button
              onClick={() => setEditing(false)}
              aria-label="סגירה"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-border hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl px-3 py-2 ${highlight ? "bg-primary-soft text-primary" : "bg-secondary text-foreground"}`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
