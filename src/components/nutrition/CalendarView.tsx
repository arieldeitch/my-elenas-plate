import { useMemo, useState } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, isSameDay, toISODate } from "@/lib/format";
import { calcCompletion } from "@/lib/completion";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const HE_DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export function CalendarView({ open, onClose }: Props) {
  const { selectedDate, setSelectedDate, activeProfile, getAllDays } = useStore();
  const [cursor, setCursor] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const days = getAllDays(activeProfile);
  const today = new Date();

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const dow = first.getDay(); // 0=sun
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < dow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  if (!open) return null;

  function statusFor(d: Date): "full" | "partial" | "empty" {
    const iso = toISODate(d);
    const data = days[iso];
    if (!data) return "empty";
    return calcCompletion(data.meals).state;
  }

  function pick(d: Date) {
    setSelectedDate(d);
    onClose();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="לוח שנה" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-lg animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="חודש קודם"
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center font-bold">
            {HE_MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="חודש הבא"
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={onClose} aria-label="סגירה" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs text-muted-foreground">
            {HE_DOW.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="aspect-square" />;
              const st = statusFor(d);
              const isSel = isSameDay(d, selectedDate);
              const isTod = isSameDay(d, today);
              return (
                <button
                  key={i}
                  onClick={() => pick(d)}
                  aria-label={`${d.getDate()} ${HE_MONTHS[d.getMonth()]}, ${statusLabel(st)}`}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 border text-sm transition-colors",
                    isSel ? "border-primary bg-primary-soft" : "border-transparent hover:bg-muted",
                    isTod && !isSel && "border-border",
                  )}
                >
                  <span className={cn("font-medium", isSel && "text-primary")}>{d.getDate()}</span>
                  <StatusDot status={st} />
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <Legend status="full" label="מלא" />
            <Legend status="partial" label="חלקי" />
            <Legend status="empty" label="ללא תיעוד" />
          </div>
        </div>
      </div>
    </div>
  );
}

function statusLabel(s: string) {
  if (s === "full") return "מלא";
  if (s === "partial") return "חלקי";
  return "ללא תיעוד";
}

function StatusDot({ status }: { status: "full" | "partial" | "empty" }) {
  const cls =
    status === "full" ? "bg-success"
    : status === "partial" ? "bg-warn"
    : "border border-destructive/60 bg-transparent";
  return <span className={cn("h-1.5 w-1.5 rounded-full", cls)} aria-hidden />;
}

function Legend({ status, label }: { status: "full" | "partial" | "empty"; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot status={status} />
      {label}
    </span>
  );
}
