import { useStore, PROFILES } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ProfileSwitcher() {
  const { activeProfile, setActiveProfile } = useStore();
  return (
    <div
      role="tablist"
      aria-label="בחירת פרופיל"
      className="inline-flex rounded-full bg-secondary p-1 shadow-soft border border-border"
    >
      {PROFILES.map((p) => {
        const active = p.id === activeProfile;
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={active}
            onClick={() => setActiveProfile(p.id)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all min-w-[92px] justify-center",
              active
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full text-xs font-bold",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
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
