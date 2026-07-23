import { Activity } from "lucide-react";

export function BrandMark() {
  return (
    <div className="flex items-center gap-2" aria-label="בריאותי">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary">
        <Activity className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <span className="text-[17px] font-extrabold tracking-tight text-primary">
        בריאותי
      </span>
    </div>
  );
}
