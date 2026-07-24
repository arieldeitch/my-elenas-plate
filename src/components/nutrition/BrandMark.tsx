import { BrandIllustration } from "@/components/brand/BrandIllustration";

export function BrandMark() {
  return (
    <div className="flex items-center gap-2" aria-label="בריאותי">
      <BrandIllustration variant="header" alt="לוגו בריאותי" />
      <span className="text-[17px] font-extrabold tracking-tight text-primary">בריאותי</span>
    </div>
  );
}
