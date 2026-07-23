import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { toISODate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WeighInForm({ open, onClose }: Props) {
  const store = useStore();
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [time, setTime] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const latest = store.weighIns[store.weighIns.length - 1];
      setWeight(latest ? String(latest.weightKg) : "");
      setDate(toISODate(new Date()));
      setTime("");
      setBodyFat("");
      setErrors({});
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }
  }, [open, onClose, store.weighIns]);

  if (!open) return null;

  const wNum = Number(weight.replace(",", "."));
  const bfNum = bodyFat ? Number(bodyFat.replace(",", ".")) : undefined;
  const fatMass =
    isFinite(wNum) && wNum > 0 && bfNum != null && isFinite(bfNum) && bfNum > 0 && bfNum < 100
      ? (wNum * bfNum) / 100
      : null;

  function submit() {
    const errs: Record<string, string> = {};
    if (!isFinite(wNum) || wNum <= 0) errs.weight = "יש להזין משקל חיובי";
    if (bodyFat) {
      if (!isFinite(bfNum!) || bfNum! <= 0 || bfNum! >= 100) errs.bf = "אחוז שומן בין 0 ל־100";
    }
    if (!date) errs.date = "יש לבחור תאריך";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    store.addWeighIn({
      dateISO: date,
      time: time || undefined,
      weightKg: wNum,
      bodyFatPct: bfNum,
    });
    toast.success("השקילה נשמרה");
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="הוספת שקילה"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-lg animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="font-bold flex-1">הוספת שקילה</div>
          <button onClick={onClose} aria-label="סגירה" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="משקל בק״ג" error={errors.weight}>
            <input
              type="number" inputMode="decimal" step="0.1" min="0"
              value={weight} onChange={(e) => setWeight(e.target.value)}
              className={inputCls(!!errors.weight)}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך" error={errors.date}>
              <input
                type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className={inputCls(!!errors.date)}
              />
            </Field>
            <Field label="שעה (לא חובה)">
              <input
                type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className={inputCls(false)}
              />
            </Field>
          </div>
          <Field label="אחוז שומן (לא חובה)" error={errors.bf}>
            <input
              type="number" inputMode="decimal" step="0.1" min="0" max="100"
              value={bodyFat} onChange={(e) => setBodyFat(e.target.value)}
              className={inputCls(!!errors.bf)}
            />
          </Field>
          {fatMass != null && (
            <div className="rounded-xl bg-secondary px-3 py-2 text-sm">
              מסת שומן: <span className="font-semibold">{formatNumber(fatMass)} ק״ג</span>
            </div>
          )}
        </div>
        <div className="border-t border-border p-3 flex gap-2">
          <button
            onClick={submit}
            className="flex-1 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            שמירת השקילה
          </button>
          <button
            onClick={onClose}
            className="rounded-2xl border border-border bg-card px-4 py-3 font-medium hover:bg-muted"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
    </div>
  );
}

function inputCls(err: boolean) {
  return cn(
    "w-full rounded-xl border bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring",
    err ? "border-destructive" : "border-input",
  );
}
