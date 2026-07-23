import { useStore, PROFILES } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ProfileSwitcher() {
  const { activeProfile, setActiveProfile } = useStore();
  const activeIndex = PROFILES.findIndex((p) => p.id === activeProfile);

  return (
    <div
      role="tablist"
      aria-label="בחירת פרופיל"
      className="relative inline-flex rounded-full bg-[#EEF2F6] p-1"
      style={{ boxShadow: "inset 0 1px 2px rgba(20,40,70,0.04)" }}
    >
      {/* Sliding indicator */}
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full bg-white shadow-soft transition-all duration-250 ease-out"
        style={{
          width: "calc(50% - 4px)",
          right: activeIndex === 0 ? "4px" : "calc(50%)",
        }}
      />
      {PROFILES.map((p, i) => {
        const active = p.id === activeProfile;
        const color = i === 0 ? "#17A668" : "#2B84D6";
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={active}
            onClick={() => setActiveProfile(p.id)}
            className={cn(
              "relative z-10 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200 min-w-[112px] justify-center",
              active ? "text-foreground" : "text-[#708197]",
            )}
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white transition-opacity"
              style={{ backgroundColor: color, opacity: active ? 1 : 0.55 }}
              aria-hidden
            >
              {p.initials}
            </span>
            <span>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}
