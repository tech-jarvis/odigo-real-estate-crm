import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Avatar({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/25 bg-gold/10 text-[10px] font-semibold text-gold",
        className
      )}
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}
