import { Home, CalendarDays, Plus, BarChart3, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  active?: "home" | "calendar" | "history" | "more";
  onHome?: () => void;
  onCalendar?: () => void;
  onAdd?: () => void;
  onHistory?: () => void;
  onMore?: () => void;
}

export function BottomNav({
  active = "home",
  onHome,
  onCalendar,
  onAdd,
  onHistory,
  onMore,
}: Props) {
  return (
    <nav
      dir="rtl"
      aria-label="ניווט תחתון"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E9EEF3] bg-white/95 backdrop-blur-md"
      style={{ boxShadow: "0 -8px 28px rgba(20,40,70,0.06)" }}
    >
      <div className="mx-auto flex max-w-[820px] items-center justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2">
        <NavItem
          icon={<Home className="h-5 w-5" strokeWidth={2} />}
          label="בית"
          active={active === "home"}
          onClick={onHome}
        />
        <NavItem
          icon={<CalendarDays className="h-5 w-5" strokeWidth={1.75} />}
          label="לוח שנה"
          active={active === "calendar"}
          onClick={onCalendar}
        />
        <button
          onClick={onAdd}
          aria-label="הוספה מהירה"
          className="-mt-6 flex flex-col items-center gap-1"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-info text-white shadow-[0_8px_20px_rgba(43,132,214,0.35)] ring-4 ring-white transition-transform active:scale-95">
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </span>
          <span className="text-xs font-medium text-info">הוספה מהירה</span>
        </button>
        <NavItem
          icon={<BarChart3 className="h-5 w-5" strokeWidth={1.75} />}
          label="היסטוריה"
          active={active === "history"}
          onClick={onHistory}
        />
        <NavItem
          icon={<MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />}
          label="עוד"
          active={active === "more"}
          onClick={onMore}
        />
      </div>
    </nav>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors",
        active ? "text-info" : "text-[#708197] hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
