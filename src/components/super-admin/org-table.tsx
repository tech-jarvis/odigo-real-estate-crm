"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2, Users, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { OrgWithCount } from "@/lib/types";
import { deleteOrganization } from "@/lib/actions/super-admin";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function OrgTable({ orgs }: { orgs: OrgWithCount[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!deletingId) return;
    setLoading(true);
    try {
      await deleteOrganization(deletingId);
      toast.success("Organization deleted");
      setDeletingId(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (orgs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No organizations yet.{" "}
          <Link href="/super-admin/organizations/new" className="text-gold hover:underline">
            Create one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Members</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orgs.map((org, i) => (
              <tr
                key={org.id}
                className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}
              >
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/super-admin/organizations/${org.id}`}
                    className="flex items-center gap-1.5 hover:text-gold"
                  >
                    {org.name}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{org.slug}</code>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {org.member_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(org.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setDeletingId(org.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Delete organization"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete organization?</DialogTitle>
            <DialogDescription>
              This will permanently delete the organization and remove all members from it.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingId(null)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
