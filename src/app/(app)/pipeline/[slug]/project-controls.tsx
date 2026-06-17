"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  archiveProject,
  deleteProject,
  restoreProject,
  permanentlyDeleteProject,
} from "../actions";

export function ProjectControls({
  projectId,
  archived,
  deletedAt,
}: {
  projectId: string;
  archived: boolean;
  deletedAt: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // ── Trash state: project is soft-deleted ─────────────────────────
  if (deletedAt) {
    return (
      <>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await restoreProject(projectId);
              if (res.error) {
                toast.error("Restore failed", { description: res.error });
                return;
              }
              toast.success("Project restored");
              queryClient.invalidateQueries({ queryKey: ["projects"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard"] });
              router.push("/pipeline");
            })
          }
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
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
          Delete permanently
        </Button>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Permanently delete?</DialogTitle>
              <DialogDescription>
                This will immediately and irreversibly remove this project and
                its entire activity log. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await permanentlyDeleteProject(projectId);
                    if (res.error) {
                      toast.error("Delete failed", { description: res.error });
                      return;
                    }
                    toast.success("Project permanently deleted");
                    queryClient.invalidateQueries({ queryKey: ["projects"] });
                    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                    router.push("/pipeline?show=trash");
                  })
                }
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

  // ── Normal state: archive toggle + move to trash ──────────────────
  function toggleArchive() {
    startTransition(async () => {
      const res = await archiveProject(projectId, !archived);
      if (res.error) {
        toast.error("Action failed", { description: res.error });
        return;
      }
      toast.success(archived ? "Project restored" : "Project archived");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteProject(projectId);
      if (res.error) {
        toast.error("Move to trash failed", { description: res.error });
        return;
      }
      toast.success("Moved to trash — restoreable for 15 days");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.push("/pipeline");
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={toggleArchive}
        disabled={pending}
      >
        {archived ? (
          <ArchiveRestore className="h-4 w-4" />
        ) : (
          <Archive className="h-4 w-4" />
        )}
        {archived ? "Restore" : "Archive"}
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move to trash?</DialogTitle>
            <DialogDescription>
              This project will be moved to trash and can be restored within
              15 days. After that it will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Move to trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
