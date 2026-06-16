import { STAGE_META } from "@/lib/types";
import type { ProjectStage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StageBadge({
  stage,
  className,
}: {
  stage: ProjectStage;
  className?: string;
}) {
  const meta = STAGE_META[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
