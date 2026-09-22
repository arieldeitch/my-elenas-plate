import type { Food } from "@/lib/domain";
import { formatPoints } from "@/lib/points";
import {
  formatPortion,
  type ReferenceGroup,
  type ReferenceRuntimeItem as ReferenceItem,
} from "@/lib/points-reference";

interface Props {
  food: Food;
  group: ReferenceGroup;
  onPick: (item: ReferenceItem) => void;
  onCancel: () => void;
}

/**
 * A food with several reference portions (DEC-035): the person picks the
 * variation explicitly — the app never chooses one silently. Compact list:
 * portion on the main line, points + category on the secondary line.
 */
export function VariantPicker({ food, group, onPick, onCancel }: Props) {
  return (
    <div className="flex flex-col gap-3" data-testid="variant-picker">
      <div className="rounded-2xl bg-secondary/60 px-3 py-2">
        <div className="text-xs text-muted-foreground">איזו כמות מהמאגר?</div>
        <div className="font-semibold text-foreground">{food.name}</div>
      </div>
      <div className="space-y-1">
        {group.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item)}
            data-testid="variant-option"
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-right hover:border-primary/40"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">{formatPortion(item.portion)}</div>
              <div className="text-xs text-muted-foreground">
                {formatPoints(item.points)} נק׳{item.category ? ` · ${item.category}` : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
      {group.hiddenCount > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {group.hiddenCount === 1
            ? "רשומה אחת נוספת במאגר מסומנת לבדיקה ואינה מוצגת."
            : `${group.hiddenCount} רשומות נוספות במאגר מסומנות לבדיקה ואינן מוצגות.`}
        </p>
      )}
      <button
        onClick={onCancel}
        className="rounded-2xl border border-border bg-card px-4 py-3 font-medium hover:bg-muted"
      >
        ביטול
      </button>
    </div>
  );
}
