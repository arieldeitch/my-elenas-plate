import { ChevronRight, ChevronLeft, Calendar } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, formatShortDate, isSameDay } from "@/lib/format";

interface Props {
  onOpenCalendar: () => void;
}

export function DateNavigator({ onOpenCalendar }: Props) {
  const { selectedDate, setSelectedDate } = useStore();
  const today = new Date();
  const isToday = isSameDay(selectedDate, today);

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white border border-[#E9EEF3] px-3 py-3 shadow-soft">
      <button
        onClick={onOpenCalendar}
        aria-label="פתיחת לוח שנה"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#2B84D6] hover:bg-[#EDF6FD] transition-colors"
      >
        <Calendar className="h-5 w-5" strokeWidth={1.75} />
      </button>
      <button
        onClick={() => setSelectedDate(addDays(selectedDate, -1))}
        aria-label="יום קודם"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#708197] hover:bg-[#F1F5F9] transition-colors"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="text-[15px] font-bold text-foreground leading-tight">
          {isToday ? "היום" : "תאריך"}
        </div>
        <div className="text-[12px] text-[#708197] leading-tight tabular-nums">
          {formatShortDate(selectedDate)}
        </div>
      </div>
      <button
        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
        aria-label="יום הבא"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#708197] hover:bg-[#F1F5F9] transition-colors"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
