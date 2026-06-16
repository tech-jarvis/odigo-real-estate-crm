import { cn } from "@/lib/utils";

/** Odigo wordmark — a precise, built mark. "O" rendered as a gold square ring. */
export function Logo({
  className,
  showWord = true,
}: {
  className?: string;
  showWord?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-[7px] border-2 border-gold">
        <span className="h-2 w-2 rounded-[2px] bg-gold" />
      </span>
      {showWord && (
        <span className="text-[15px] font-semibold tracking-tight">
          Odigo<span className="text-gold"> CRM</span>
        </span>
      )}
    </span>
  );
}
