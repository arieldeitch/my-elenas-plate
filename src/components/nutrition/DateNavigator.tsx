import { ChevronRight, ChevronLeft, CalendarDays } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, formatShortDate, formatWeekday, isSameDay } from "@/lib/format";

interface Props {
  onOpenCalendar: () => void;
}

export function DateNavigator({ onOpenCalendar }: Props) {
  const { selectedDate, setSelectedDate } = useStore();
  const today = new Date();
  const isToday = isSameDay(selectedDate, today);

  return (
    <div className="flex items-center gap-1 rounded-2xl bg-card px-2 py-1.5 shadow-soft border border-border">
      {/* Previous day (visually right in RTL is "previous"? Use icon logically) */}
      <button
        onClick={() => setSelectedDate(addDays(selectedDate, -1))}
        aria-label="יום קודם"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-muted"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <button
        onClick={onOpenCalendar}
        className="min-w-0 flex-1 rounded-xl px-3 py-2 text-center hover:bg-muted"
        aria-label="פתיחת לוח שנה"
      >
        <div className="text-sm font-bold text-foreground truncate">
          {isToday ? "היום" : formatWeekday(selectedDate)}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {formatShortDate(selectedDate)}
        </div>
      </button>
      <button
        onClick={onOpenCalendar}
        aria-label="לוח שנה"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-muted"
      >
        <CalendarDays className="h-5 w-5" />
      </button>
      <button
        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
        aria-label="יום הבא"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-muted"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
    </div>
  );
}
