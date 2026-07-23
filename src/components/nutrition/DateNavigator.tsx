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
    <div className="flex items-center gap-1 rounded-full bg-white border border-[#E9EEF3] px-2 py-1.5 shadow-soft">
      <button
        onClick={() => setSelectedDate(addDays(selectedDate, -1))}
        aria-label="יום קודם"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#708197] hover:bg-[#F1F5F9] transition-colors duration-200"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
      </button>
      <button
        onClick={onOpenCalendar}
        className="min-w-0 flex-1 rounded-full px-3 py-2 hover:bg-[#F7F9FB] transition-colors duration-200 flex items-center justify-center gap-2.5"
        aria-label="פתיחת לוח שנה"
      >
        <CalendarDays className="h-4 w-4 text-[#708197]" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 text-center">
          <div className="text-sm font-semibold text-foreground truncate leading-tight">
            {isToday ? "היום" : formatWeekday(selectedDate)}
          </div>
          <div className="text-[11px] text-[#708197] truncate leading-tight">
            {formatShortDate(selectedDate)}
          </div>
        </div>
      </button>
      <button
        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
        aria-label="יום הבא"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#708197] hover:bg-[#F1F5F9] transition-colors duration-200"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
