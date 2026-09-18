import { PROFILES, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * One-time device chooser (M1 Phase B): "מי משתמש/ת במכשיר הזה?".
 *
 * Shown only while this device has no stored default profile. Picking a
 * profile stores the device preference and makes it the active profile. The
 * account stays shared; the ProfileSwitcher still allows temporary switching
 * and can re-open this chooser to change the device default.
 */
export function DeviceProfileChooser() {
  const { deviceProfile, deviceChooserOpen, chooseDeviceProfile, closeDeviceChooser } = useStore();
  if (!deviceChooserOpen) return null;
  const canDismiss = deviceProfile !== null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-profile-title"
      data-testid="device-profile-chooser"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 px-5"
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-right shadow-soft">
        <h2 id="device-profile-title" className="text-lg font-bold text-foreground">
          מי משתמש/ת במכשיר הזה?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          הבחירה נשמרת במכשיר הזה בלבד וקובעת איזה פרופיל ייפתח כברירת מחדל. אפשר תמיד לעבור לפרופיל
          השני מהמסך הראשי.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {PROFILES.map((p, i) => {
            const color = p.color;
            const current = p.id === deviceProfile;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => chooseDeviceProfile(p.id)}
                aria-pressed={current}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-base font-semibold transition-colors",
                  current
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary",
                )}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: color }}
                  aria-hidden
                >
                  {p.initials}
                </span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
        {canDismiss && (
          <button
            type="button"
            onClick={closeDeviceChooser}
            className="mt-4 w-full rounded-2xl py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ביטול
          </button>
        )}
      </div>
    </div>
  );
}
