import Link from "next/link";
import { FileText, Phone, ArrowRightLeft, StickyNote } from "lucide-react";
import type { ActivityWithAuthor, ActivityType } from "@/lib/types";
import { ACTIVITY_META } from "@/lib/types";
import { formatRelativeTime, cn } from "@/lib/utils";
import { Avatar } from "@/components/shared/avatar";
import { FilePreview } from "@/components/ui/file-preview";

function ChangeList({ body }: { body: string }) {
  if (body.startsWith("[")) {
    try {
      const changes = JSON.parse(body) as string[];
      return (
        <ul className="mt-1.5 space-y-1.5 rounded-md border border-border/60 bg-secondary/40 px-3 py-2.5">
          {changes.map((change, i) => {
            const arrow = change.indexOf(" → ");
            if (arrow !== -1) {
              const label = change.slice(0, arrow);
              const rest  = change.slice(arrow + 3);
              const mid   = label.lastIndexOf(": ");
              const field = mid !== -1 ? label.slice(0, mid) : null;
              const from  = mid !== -1 ? label.slice(mid + 2) : label;
              return (
                <li key={i} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
                  {field && (
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {field}
                    </span>
                  )}
                  <span className="text-muted-foreground/70 line-through decoration-muted-foreground/40">
                    {from}
                  </span>
                  <span className="text-muted-foreground/50 text-xs">→</span>
                  <span className="font-medium text-foreground/90">{rest}</span>
                </li>
              );
            }
            return (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                {change}
              </li>
            );
          })}
        </ul>
      );
    } catch {}
  }
  return <p className="mt-0.5 truncate text-sm text-foreground/90">{body}</p>;
}

const ICONS: Record<ActivityType, typeof FileText> = {
  note: StickyNote,
  status_change: ArrowRightLeft,
  file_reference: FileText,
  call_summary: Phone,
};

type ActivityGroup = {
  projectId: string | null;
  projectName: string | null;
  projectSlug: string | null;
  entries: ActivityWithAuthor[];
};

function groupByProject(entries: ActivityWithAuthor[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const entry of entries) {
    const pid = entry.project?.id ?? null;
    const last = groups[groups.length - 1];
    if (last && last.projectId === pid) {
      last.entries.push(entry);
    } else {
      groups.push({
        projectId: pid,
        projectName: entry.project?.name ?? null,
        projectSlug: entry.project?.slug ?? null,
        entries: [entry],
      });
    }
  }
  return groups;
}

export function ActivityFeed({
  entries,
  variant = "timeline",
}: {
  entries: ActivityWithAuthor[];
  variant?: "timeline" | "feed";
}) {
  if (variant === "feed") {
    const groups = groupByProject(entries);
    return (
      <div className="space-y-4">
        {groups.map((group, gi) => (
          <div key={gi} className="rounded-lg border border-border/50 bg-secondary/20 px-3 pt-2.5 pb-1">
            {/* Project header */}
            <div className="mb-2 flex items-center gap-1.5">
              {group.projectSlug ? (
                <Link
                  href={`/pipeline/${group.projectSlug}`}
                  className="text-[11px] font-semibold text-gold hover:underline"
                >
                  {group.projectName}
                </Link>
              ) : (
                <span className="text-[11px] font-semibold text-muted-foreground">No project</span>
              )}
              <span className="h-px flex-1 bg-border/60" />
            </div>

            {/* Timeline entries within the group */}
            <ol className="relative">
              {group.entries.map((entry, i) => {
                const Icon = ICONS[entry.type];
                const meta = ACTIVITY_META[entry.type];
                const last = i === group.entries.length - 1;
                const hasFile = entry.type === "file_reference" && entry.file_url;

                return (
                  <li key={entry.id} className="relative flex gap-3 pb-4">
                    {!last && (
                      <span
                        aria-hidden
                        className="absolute left-[13px] top-7 h-full w-px bg-border"
                      />
                    )}
                    <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-secondary">
                      <Icon className={cn("h-3 w-3", meta.tint)} />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={cn("text-xs font-medium", meta.tint)}>
                          {meta.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(entry.created_at)}
                        </span>
                      </div>

                      {entry.body && (!hasFile || entry.body !== entry.file_url) && (
                        <ChangeList body={entry.body} />
                      )}
                      {hasFile && (
                        <FilePreview url={entry.file_url!} label={entry.body || undefined} />
                      )}

                      {entry.author && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Avatar
                            name={entry.author.full_name}
                            className="h-4 w-4 text-[8px]"
                          />
                          <span className="text-xs text-muted-foreground">
                            {entry.author.full_name ?? entry.author.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ol className="relative space-y-0">
      {entries.map((entry, i) => {
        const Icon = ICONS[entry.type];
        const meta = ACTIVITY_META[entry.type];
        const last = i === entries.length - 1;
        const hasFile = entry.type === "file_reference" && entry.file_url;

        return (
          <li key={entry.id} className="relative flex gap-3 pb-5">
            {!last && (
              <span
                aria-hidden
                className="absolute left-[15px] top-8 h-full w-px bg-border"
              />
            )}
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary">
              <Icon className={cn("h-3.5 w-3.5", meta.tint)} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={cn("text-xs font-medium", meta.tint)}>
                  {meta.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(entry.created_at)}
                </span>
              </div>

              {/* Body text — skip for file entries where body is just the filename */}
              {entry.body && (!hasFile || entry.body !== entry.file_url) && (
                <ChangeList body={entry.body} />
              )}

              {/* Inline file preview */}
              {hasFile && (
                <FilePreview url={entry.file_url!} label={entry.body || undefined} />
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {entry.author && (
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      name={entry.author.full_name}
                      className="h-4 w-4 text-[8px]"
                    />
                    <span className="text-xs text-muted-foreground">
                      {entry.author.full_name ?? entry.author.email}
                    </span>
                  </div>
                )}
                {entry.project?.slug && (
                  <Link
                    href={`/pipeline/${entry.project.slug}`}
                    className="truncate text-xs text-muted-foreground hover:text-gold hover:underline"
                  >
                    {entry.project.name}
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
