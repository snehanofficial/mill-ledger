import { cn } from "@/lib/utils";

const BRAND_LOGO_SIZES = {
  sm: { px: 28, className: "size-7 rounded-control" },
  md: { px: 32, className: "size-8 rounded-lg" },
  nav: { px: 36, className: "size-9 rounded-control" },
  lg: { px: 48, className: "size-12 rounded-control" },
} as const;

export type BrandLogoSize = keyof typeof BRAND_LOGO_SIZES;

export interface BrandLogoProps {
  size?: BrandLogoSize;
  alt?: string;
  className?: string;
}

/**
 * Standardized MillLedger brand mark backed by the custom emblem in `/favicon.svg`.
 */
export function BrandLogo({
  size = "md",
  alt = "",
  className,
}: BrandLogoProps) {
  const { px, className: sizeClass } = BRAND_LOGO_SIZES[size];
  const isDecorative = alt === "";

  return (
    <img
      src="/favicon.svg"
      alt={alt}
      width={px}
      height={px}
      aria-hidden={isDecorative || undefined}
      className={cn(
        "shrink-0 object-contain select-none",
        sizeClass,
        className,
      )}
    />
  );
}
