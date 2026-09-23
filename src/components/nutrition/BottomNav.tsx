import { CalendarDays, ChefHat, Home, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  active?: "home" | "calendar" | "dishes";
  onHome?: () => void;
  onCalendar?: () => void;
  onAdd?: () => void;
  /** Navigate to the dedicated dishes area (DEC-037). */
  onDishes?: () => void;
}

/** Deliberately only real destinations/actions: Home · Dishes · Quick Add · Journal. */
export function BottomNav({ active = "home", onHome, onCalendar, onAdd, onDishes }: Props) {
  return (
    <nav
      dir="rtl"
      aria-label="ניווט תחתון"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md"
      style={{ boxShadow: "var(--shadow-banner)" }}
    >
      <div className="mx-auto grid max-w-[820px] grid-cols-4 items-end px-3 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2 sm:px-5">
        <NavItem
          icon={<Home className="h-5 w-5" strokeWidth={2} />}
          label="בית"
          active={active === "home"}
          onClick={onHome}
        />
        <NavItem
          icon={<ChefHat className="h-5 w-5" strokeWidth={1.75} />}
          label="תבשילים"
          active={active === "dishes"}
          onClick={onDishes}
        />
        <button
          type="button"
          onClick={onAdd}
          aria-label="הוספה מהירה"
          className="-mt-6 flex min-h-[64px] flex-col items-center justify-end gap-1"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-info text-white shadow-[0_8px_20px_rgba(31,111,189,0.28)] ring-4 ring-card transition-transform active:scale-95">
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </span>
          <span className="text-xs font-medium text-info">הוספה מהירה</span>
        </button>
        <NavItem
          icon={<CalendarDays className="h-5 w-5" strokeWidth={1.75} />}
          label="יומן"
          active={active === "calendar"}
          onClick={onCalendar}
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
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors",
        active ? "text-info" : "text-muted-foreground hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
