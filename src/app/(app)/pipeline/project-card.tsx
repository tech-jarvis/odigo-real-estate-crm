"use client";

import Link from "next/link";
import { CalendarClock, Building2 } from "lucide-react";
import type { ProjectWithRelations } from "@/lib/types";
import {
  formatCurrency,
  formatDate,
  daysUntil,
  cn,
} from "@/lib/utils";
import { Avatar } from "@/components/shared/avatar";

export function ProjectCard({
  project,
  dragging,
}: {
  project: ProjectWithRelations & { slug: string };
  dragging?: boolean;
}) {
  const dleft = daysUntil(project.estimated_end_date);
  const closingSoon =
    dleft !== null && dleft >= 0 && dleft <= 30 && project.stage !== "completed";

  return (
    <Link
      href={`/pipeline/${project.slug}`}
      className={cn(
        "group block rounded-lg border border-border bg-card p-3.5 shadow-sm transition-all duration-150 hover:border-gold/40 hover:shadow-md",
        dragging && "border-gold/50 shadow-lg ring-1 ring-gold/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-foreground line-clamp-2 group-hover:text-gold">
          {project.name}
        </p>
        <Avatar name={project.assignee?.full_name} />
      </div>

      {project.company && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{project.company.name}</span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          {formatCurrency(Number(project.project_value))}
        </span>
        {project.estimated_end_date && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs",
              closingSoon ? "text-gold" : "text-muted-foreground"
            )}
          >
            <CalendarClock className="h-3 w-3" />
            {closingSoon && dleft !== null
              ? `${dleft}d left`
              : formatDate(project.estimated_end_date)}
          </span>
        )}
      </div>
    </Link>
  );
}
