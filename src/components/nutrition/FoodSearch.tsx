import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Star, Clock, Plus, X, Coffee } from "lucide-react";
import type { Food } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { normalize } from "@/lib/food-catalog";
import { cn } from "@/lib/utils";

interface Props {
  onPick: (food: Food) => void;
  onCreate: (name: string) => void;
  /** Fast path straight into the coffee editor. */
  onAddCoffee?: () => void;
}

export function FoodSearch({ onPick, onCreate, onAddCoffee }: Props) {
  const { foods, favorites, recents } = useStore();
  const [raw, setRaw] = useState("");
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQ(raw), 180);
    return () => clearTimeout(t);
  }, [raw]);

  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const favList = favorites.map((id) => foodById.get(id)).filter(Boolean) as Food[];
  const favSet = new Set(favList.map((f) => f.id));
  const recentList = recents
    .map((id) => foodById.get(id))
    .filter((f): f is Food => !!f && !favSet.has(f.id));

  const nq = normalize(q);
  const results = nq ? foods.filter((f) => normalize(f.name).includes(nq)).slice(0, 20) : [];
  const exact = nq ? foods.find((f) => normalize(f.name) === nq) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="חיפוש מאכל"
          aria-label="חיפוש מאכל"
          className="w-full rounded-2xl border border-input bg-card py-3 pr-10 pl-10 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        {raw && (
          <button
            onClick={() => setRaw("")}
            aria-label="ניקוי חיפוש"
            className="absolute top-1/2 left-2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!nq && onAddCoffee && (
        <button
          type="button"
          onClick={onAddCoffee}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#E5D8C3] bg-[#FBF4E8] px-4 py-3 text-right transition-colors hover:bg-[#F6EAD6]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#B4772E]">
            <Coffee className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-foreground">הוספת קפה מהירה</span>
            <span className="block text-xs text-muted-foreground">סוג, חלב וכמות בכמה הקשות</span>
          </span>
        </button>
      )}

      {!nq && (
        <div className="space-y-4">
          {favList.length > 0 && (
            <Section title="מועדפים" icon={<Star className="h-4 w-4" />}>
              <Grid>
                {favList.map((f) => (
                  <FoodChip
                    key={f.id}
                    food={f}
                    isFav
                    recent={recents.includes(f.id)}
                    onPick={onPick}
                  />
                ))}
              </Grid>
            </Section>
          )}
          {recentList.length > 0 && (
            <Section title="אחרונים" icon={<Clock className="h-4 w-4" />}>
              <Grid>
                {recentList.map((f) => (
                  <FoodChip key={f.id} food={f} onPick={onPick} />
                ))}
              </Grid>
            </Section>
          )}
        </div>
      )}

      {nq && (
        <div className="space-y-1">
          {results.map((f) => (
            <button
              key={f.id}
              onClick={() => onPick(f)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 text-right hover:border-primary/40"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{f.name}</div>
                {f.category && <div className="text-xs text-muted-foreground">{f.category}</div>}
              </div>
              {favSet.has(f.id) && <Star className="h-4 w-4 text-warn fill-warn" />}
            </button>
          ))}
          {!exact && (
            <button
              onClick={() => onCreate(raw.trim())}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary-soft/50 px-3 py-3 text-right text-primary font-medium hover:bg-primary-soft"
            >
              <Plus className="h-4 w-4" />
              הוספת “{raw.trim()}” כמאכל חדש
            </button>
          )}
          {results.length === 0 && !raw.trim() && (
            <div className="text-sm text-muted-foreground py-6 text-center">אין תוצאות</div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function FoodChip({
  food,
  isFav,
  recent,
  onPick,
}: {
  food: Food;
  isFav?: boolean;
  recent?: boolean;
  onPick: (f: Food) => void;
}) {
  return (
    <button
      onClick={() => onPick(food)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm hover:border-primary/40",
      )}
    >
      {isFav && <Star className="h-3.5 w-3.5 text-warn fill-warn" />}
      <span>{food.name}</span>
      {isFav && recent && <span className="text-[11px] text-muted-foreground">בשימוש לאחרונה</span>}
    </button>
  );
}
