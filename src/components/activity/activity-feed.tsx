import Link from "next/link";
import { FileText, Phone, ArrowRightLeft, StickyNote } from "lucide-react";
import type { ActivityWithAuthor, ActivityType } from "@/lib/types";
import { ACTIVITY_META } from "@/lib/types";
import { formatRelativeTime, cn } from "@/lib/utils";
import { Avatar } from "@/components/shared/avatar";
import { FilePreview } from "@/components/ui/file-preview";

const ICONS: Record<ActivityType, typeof FileText> = {
  note: StickyNote,
  status_change: ArrowRightLeft,
  file_reference: FileText,
  call_summary: Phone,
};

export function ActivityFeed({
  entries,
}: {
  entries: ActivityWithAuthor[];
}) {
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
                <p className="mt-0.5 truncate text-sm text-foreground/90">{entry.body}</p>
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
