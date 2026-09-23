import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Archive, ChefHat, Info, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import type { Dish } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { normalizeFoodName } from "@/lib/food-normalize";
import { formatPoints } from "@/lib/points";
import { formatPointsPerGram } from "@/lib/dishes";
import { ESTIMATED_SHORT } from "@/lib/label-estimator";
import { DishEditor } from "@/components/nutrition/DishEditor";
import { DishLogSheet } from "@/components/nutrition/DishLogSheet";
import { BottomNav } from "@/components/nutrition/BottomNav";
import { BrandMark } from "@/components/nutrition/BrandMark";
import { SyncStatus } from "@/components/nutrition/SyncStatus";
import { ProfileSwitcher } from "@/components/nutrition/ProfileSwitcher";
import { useKeyboardSafeViewport } from "@/lib/use-keyboard-safe-viewport";

export const Route = createFileRoute("/dishes")({
  head: () => ({
    meta: [
      { title: "תבשילים — מעקב תזונה משותף" },
      {
        name: "description",
        content: "תבשילים של הבית: מרכיבים, משקל מוכן וניקוד לגרם.",
      },
    ],
  }),
  component: DishesPage,
});

/**
 * The dedicated dishes area (DEC-037 R2): a real first-class surface for the
 * household's reusable dishes — list, search, create, edit, archive and log a
 * serving into a meal.
 */
function DishesPage() {
  useKeyboardSafeViewport();
  const store = useStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ dish: Dish | null } | null>(null);
  const [logging, setLogging] = useState<Dish | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const list = useMemo(() => {
    const source = showArchived ? store.allDishes : store.dishes;
    const q = normalizeFoodName(query);
    if (!q) return source;
    return source.filter((d) => normalizeFoodName(d.name).includes(q));
  }, [store.dishes, store.allDishes, showArchived, query]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <main className="mx-auto max-w-[820px] px-5 pt-5 sm:pt-6">
        <h1 className="sr-only">תבשילים</h1>
        <header className="mb-3 flex min-w-0 items-start justify-between gap-2">
          <ProfileSwitcher />
          <div className="flex shrink-0 flex-col items-end gap-1">
            <BrandMark />
            <SyncStatus />
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"
              aria-hidden
            >
              <ChefHat className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-foreground">תבשילים</h2>
              <p className="text-[12px] text-muted-foreground">
                תבשיל נשמר פעם אחת עם המרכיבים והמשקל המוכן, ואז רושמים ממנו לפי משקל המנה.
              </p>
            </div>
          </div>

          {!store.dishesSupported && (
            <p
              className="mt-3 rounded-xl border border-warn/40 bg-warn-soft px-3 py-2 text-[12px]"
              data-testid="dishes-schema-notice"
            >
              שמירת תבשילים תתאפשר אחרי עדכון השרת. אפשר להמשיך לתעד ארוחות כרגיל.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                aria-label="חיפוש תבשיל"
                placeholder="חיפוש תבשיל"
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-2xl border border-input bg-card py-3 pr-10 pl-3 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={() => setEditing({ dish: null })}
              data-testid="dish-new"
              className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-primary px-4 font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              חדש
            </button>
          </div>
        </section>

        <section className="mt-4 space-y-2" data-testid="dish-list">
          {list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {query ? "לא נמצא תבשיל בשם הזה." : "עדיין אין תבשילים. אפשר ליצור אחד חדש."}
            </p>
          ) : (
            list.map((dish) => (
              <article
                key={dish.id}
                data-testid="dish-card"
                data-dish-id={dish.id}
                data-archived={dish.isActive === false ? "true" : "false"}
                className="rounded-2xl border border-border bg-card p-3 shadow-soft"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">
                      {dish.name}
                      {dish.hasEstimatedIngredient && (
                        <span className="mr-2 rounded-full bg-info-soft px-1.5 py-0.5 text-[10px] font-semibold text-info">
                          {ESTIMATED_SHORT}
                        </span>
                      )}
                      {dish.isActive === false && (
                        <span className="mr-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          בארכיון
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {formatPointsPerGram(dish.pointsPerGram)} · {formatPoints(dish.totalPoints)}{" "}
                      נק׳ ל-{dish.finalWeightG} גרם
                      {dish.usualServingWeightG != null
                        ? ` · מנה רגילה ${dish.usualServingWeightG} גרם`
                        : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80">
                      {dish.ingredients.length} מרכיבים · גרסה {dish.revision}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLogging(dish)}
                    data-testid="dish-log"
                    disabled={dish.isActive === false}
                    className="min-h-10 flex-1 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    רישום לארוחה
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ dish })}
                    data-testid="dish-edit"
                    aria-label={`עריכה: ${dish.name}`}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => store.setDishActive(dish.id, dish.isActive === false)}
                    data-testid="dish-archive"
                    aria-label={
                      dish.isActive === false
                        ? `שחזור: ${dish.name}`
                        : `העברה לארכיון: ${dish.name}`
                    }
                    className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card"
                  >
                    {dish.isActive === false ? (
                      <RotateCcw className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>

        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          data-testid="dish-toggle-archived"
          className="mt-3 text-xs text-muted-foreground underline"
        >
          {showArchived ? "הסתרת תבשילים בארכיון" : "הצגת תבשילים בארכיון"}
        </button>

        <p className="mt-4 flex items-start gap-1 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          עריכת תבשיל יוצרת גרסה חדשה. ארוחות שכבר נרשמו שומרות את הניקוד שלהן.
        </p>
      </main>

      {editing && (
        <DishEditor
          open
          dish={editing.dish}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
      <DishLogSheet dish={logging} onClose={() => setLogging(null)} />

      <BottomNav
        active="dishes"
        onHome={() => router.navigate({ to: "/" })}
        onCalendar={() => router.navigate({ to: "/" })}
        onAdd={() => setEditing({ dish: null })}
        onDishes={() => undefined}
      />
    </div>
  );
}
