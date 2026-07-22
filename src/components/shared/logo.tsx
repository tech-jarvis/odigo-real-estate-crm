import { cn } from "@/lib/utils";

/**
 * Odigo brand mark. `showWord` renders the full SMB logo lockup (swapping
 * light/dark-background variants with the active theme); otherwise just the
 * Odigo arrow on its own, which the brand guidelines permit as a standalone
 * touchstone mark.
 */
export function Logo({
  className,
  showWord = true,
}: {
  className?: string;
  showWord?: boolean;
}) {
  if (!showWord) {
    return (
      <span className={cn("inline-flex h-7 w-7 items-center justify-center", className)}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-label="Odigo">
          <polygon points="23,18.8 77,50 23,81.2" fill="#218884" />
        </svg>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/odigo-logo-light-bg.svg"
        alt="Odigo Small Business"
        className="block h-6 w-auto dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/odigo-logo-dark-bg.svg"
        alt="Odigo Small Business"
        className="hidden h-6 w-auto dark:block"
      />
    </span>
  );
}
