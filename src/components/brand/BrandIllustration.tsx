import { cn } from "@/lib/utils";
import brandAsset from "@/assets/brand-illustration.png.asset.json";

type Variant = "auth" | "header" | "empty-state" | "loading";

interface Props {
  variant?: Variant;
  className?: string;
  alt?: string;
}

const SIZES: Record<Variant, string> = {
  auth: "w-40 h-40 sm:w-48 sm:h-48",
  header: "w-11 h-11",
  "empty-state": "w-32 h-32",
  loading: "w-24 h-24",
};

/**
 * Primary brand artwork. Uses the shared illustration asset with variants for
 * different placements. Preserves aspect ratio and lazy-loads where relevant.
 */
export function BrandIllustration({
  variant = "header",
  className,
  alt = "איור בריאותי — שני אנשים אוחזים קערת אוכל בריאה",
}: Props) {
  const eager = variant === "auth" || variant === "loading";
  return (
    <img
      src={brandAsset.url}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      width={512}
      height={512}
      className={cn("object-contain select-none", SIZES[variant], className)}
      draggable={false}
    />
  );
}
