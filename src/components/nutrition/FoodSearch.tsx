import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Star, Clock, Plus, X, Coffee, SlidersHorizontal } from "lucide-react";
import type { Food } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { buildFoodSearchIndex, findFoodByName, searchFoods } from "@/lib/food-search";
import { normalizeFoodName } from "@/lib/food-normalize";
import { formatQuantity, usualQuantity } from "@/lib/quantity";
import { formatPoints } from "@/lib/points";
import {
  formatPortion,
  getReferenceIndex,
  groupForFood,
  groupPointsSummary,
} from "@/lib/points-reference";
import { cn } from "@/lib/utils";

/**
 * Secondary line of a result (DEC-035): reference portion · points · category,
 * or "N כמויות" with the points range when the food has several portions.
 * Foods without a reference keep their category only — no invented number.
 */
export function referenceLine(food: Food): string | null {
  const group = groupForFood(getReferenceIndex(), food);
  if (group && group.items.length > 0) {
    const parts: string[] = [];
    if (group.items.length === 1) {
      const item = group.items[0];
      parts.push(formatPortion(item.portion), `${formatPoints(item.points)} נק׳`);
    } else {
      const range = groupPointsSummary(group)!;
      parts.push(
        `${group.items.length} כמויות`,
        range.min === range.max
          ? `${formatPoints(range.min)} נק׳`
          : `${formatPoints(range.min)}–${formatPoints(range.max)} נק׳`,
      );
    }
    if (group.category) parts.push(group.category);
    return parts.join(" · ");
  }
  if (food.pointsStatus === "confirmed" && food.pointsPerPortion != null) {
    return [
      `${food.portionAmount ?? 1} ${food.portionUnit ?? food.defaultUnit ?? ""}`.trim(),
      `${formatPoints(food.pointsPerPortion)} נק׳`,
      food.category,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return food.category ?? null;
}

/** Results shown per query. The catalog is never rendered in full. */
const RESULT_LIMIT = 20;

interface Props {
  /**
   * A food was chosen — from a favourite / recent chip OR a typed result (one
   * path since M2-6). The caller adds it immediately when its usual quantity
   * is trusted and returns "added" (the search box clears so the new row and
   * the chips are visible again), or opens the quantity / coffee step and
   * returns "opened".
   */
  onChoose: (food: Food, source: "typed" | "quick") => "added" | "opened";
  onCreate: (name: string) => void;
  /** Fast path straight into the coffee editor. */
  onAddCoffee?: () => void;
  /** Focus the search box on mount (default true). Off when the meal already has entries. */
  autoFocus?: boolean;
}

export function FoodSearch({ onChoose, onCreate, onAddCoffee, autoFocus = true }: Props) {
  function choose(food: Food, source: "typed" | "quick") {
    if (onChoose(food, source) === "added") {
      setRaw("");
      setQ("");
      inputRef.current?.focus();
    }
  }
  const { foods, favorites, recents } = useStore();
  const [raw, setRaw] = useState("");
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

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

  // Normalizing the whole catalog once per list change (not per keystroke) keeps
  // typing responsive on a several-hundred-item catalog.
  const index = useMemo(() => buildFoodSearchIndex(foods), [foods]);
  const nq = normalizeFoodName(q);
  // Ranked by the search tiers; inside the list, foods the person used recently
  // or favourited come first — the canonical reference rows stay visible below.
  const results = useMemo(() => {
    const ranked = searchFoods(index, q, RESULT_LIMIT);
    const recentRank = new Map(recents.map((id, i) => [id, i]));
    const score = (food: Food) =>
      (favSet.has(food.id) ? 0 : 1) * 1000 + (recentRank.get(food.id) ?? 999);
    return ranked
      .map((food, i) => ({ food, i }))
      .sort((a, b) => score(a.food) - score(b.food) || a.i - b.i)
      .map((x) => x.food);
    // favSet is derived from favorites; recents/favorites are stable arrays from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, q, recents, favorites]);
  const exact = findFoodByName(index, q);

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
            className="absolute top-1/2 left-1 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
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
                    onChoose={(food) => choose(food, "quick")}
                  />
                ))}
              </Grid>
            </Section>
          )}
          {recentList.length > 0 && (
            <Section title="אחרונים" icon={<Clock className="h-4 w-4" />}>
              <Grid>
                {recentList.map((f) => (
                  <FoodChip key={f.id} food={f} onChoose={(food) => choose(food, "quick")} />
                ))}
              </Grid>
            </Section>
          )}
          {(favList.length > 0 || recentList.length > 0) && (
            <p className="text-[11px] text-muted-foreground" data-testid="quick-add-hint">
              הקשה על מאכל מוסיפה אותו בכמות הרגילה — אפשר לתקן אחר כך.
            </p>
          )}
        </div>
      )}

      {nq && (
        <div className="space-y-1">
          {results.map((f) => {
            const hint = f.kind === "coffee" ? "סוג וחלב" : "בחירת כמות";
            return (
              <button
                key={f.id}
                onClick={() => choose(f, "typed")}
                data-testid="search-result"
                data-direct="false"
                aria-label={`${f.name}, ${f.kind === "coffee" ? "פתיחת עורך הקפה" : "פתיחת בחירת כמות"}`}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-right hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{f.name}</div>
                  {referenceLine(f) && (
                    <div
                      className="truncate text-xs text-muted-foreground"
                      data-testid="result-detail"
                    >
                      {referenceLine(f)}
                    </div>
                  )}
                </div>
                {favSet.has(f.id) && (
                  <Star className="h-4 w-4 shrink-0 text-warn fill-warn" aria-hidden />
                )}
                {/* What the tap will do: the usual quantity, or a small "choose" cue. */}
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] tabular-nums",
                    "bg-secondary text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {f.kind === "coffee" ? (
                    <Coffee className="h-3 w-3" />
                  ) : (
                    <SlidersHorizontal className="h-3 w-3" />
                  )}
                  {hint}
                </span>
              </button>
            );
          })}
          {!exact && (
            <button
              onClick={() => onCreate(raw.trim())}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary-soft/50 px-3 py-3 text-right text-primary font-medium hover:bg-primary-soft"
            >
              <Plus className="h-4 w-4" />
              הוספת “{raw.trim()}” כמאכל חדש
            </button>
          )}
          {results.length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center">
              לא נמצא מאכל תואם בקטלוג.
            </div>
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
  onChoose,
}: {
  food: Food;
  isFav?: boolean;
  recent?: boolean;
  onChoose: (f: Food) => void;
}) {
  const usual = usualQuantity(food);
  return (
    <button
      onClick={() => onChoose(food)}
      data-direct={usual ? "true" : "false"}
      aria-label={
        usual
          ? `${food.name}, הוספה של ${formatQuantity(usual)}`
          : `${food.name}, ${food.kind === "coffee" ? "פתיחת עורך הקפה" : "פתיחת בחירת כמות"}`
      }
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
