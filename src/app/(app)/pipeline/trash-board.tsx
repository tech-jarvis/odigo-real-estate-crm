"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Trash2, Loader2, Clock } from "lucide-react";
import { formatDistanceToNow, differenceInDays, addDays } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { restoreProject, permanentlyDeleteProject } from "./actions";
import type { ProjectWithRelations } from "@/lib/types";

const RETENTION_DAYS = 15;

type TrashedProject = ProjectWithRelations & { deleted_at: string };

function daysLeft(deletedAt: string): number {
  return Math.max(
    0,
    differenceInDays(addDays(new Date(deletedAt), RETENTION_DAYS), new Date())
  );
}

function TrashRow({ project }: { project: TrashedProject }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const remaining = daysLeft(project.deleted_at);
  const deletedAgo = formatDistanceToNow(new Date(project.deleted_at), {
    addSuffix: true,
  });
  const urgent = remaining <= 3;

  function handleRestore() {
    startTransition(async () => {
      const res = await restoreProject(project.id);
      if (res.error) {
        toast.error("Restore failed", { description: res.error });
        return;
      }
      toast.success("Project restored to pipeline");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    });
  }

  function handlePermanentDelete() {
    startTransition(async () => {
      const res = await permanentlyDeleteProject(project.id);
      if (res.error) {
        toast.error("Delete failed", { description: res.error });
        return;
      }
      toast.success("Project permanently deleted");
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    });
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{project.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Moved to trash {deletedAgo}
              {project.company && (
                <span className="before:mx-1 before:content-['·']">
                  {project.company.name}
                </span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <Badge
              className={
                urgent
                  ? "border-destructive/30 bg-destructive/10 text-destructive text-xs"
                  : "text-xs"
              }
            >
              <Clock className="mr-1 h-3 w-3" />
              {remaining}d left
            </Badge>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleRestore}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArchiveRestore className="h-4 w-4" />
              )}
              Restore
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Permanently delete this project?</DialogTitle>
            <DialogDescription>
              <strong>{project.name}</strong> and its entire activity log will
              be removed immediately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handlePermanentDelete}
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TrashBoard({ projects }: { projects: TrashedProject[] }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-secondary/20 py-16 text-center">
        <Trash2 className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">Trash is empty</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Projects you delete will appear here for {RETENTION_DAYS} days before
          permanent removal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((p) => (
        <TrashRow key={p.id} project={p} />
      ))}
    </div>
  );
}
