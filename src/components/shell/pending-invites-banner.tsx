"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { acceptOrgInvite, declineOrgInvite } from "@/lib/actions/invitations";
import type { OrgMembershipWithOrg } from "@/lib/types";
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

export function PendingInvitesBanner({ invites }: { invites: OrgMembershipWithOrg[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<{ orgId: string; action: "accept" | "decline" } | null>(
    null
  );

  const accept = useMutation({
    mutationFn: (orgId: string) => acceptOrgInvite(orgId),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`You've joined ${res.orgName}.`);
      setConfirming(null);
      // Gaining a new org can change which orgs/data are visible anywhere
      // in the shell (switcher, companies, projects...) — drop the cache
      // rather than trying to patch every affected query individually.
      queryClient.clear();
      router.refresh();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const decline = useMutation({
    mutationFn: (orgId: string) => declineOrgInvite(orgId),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Declined the invitation to join ${res.orgName}.`);
      setConfirming(null);
      router.refresh();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  if (invites.length === 0) return null;

  const confirmingInvite = invites.find((inv) => inv.org_id === confirming?.orgId);
  const isPending = accept.isPending || decline.isPending;

  return (
    <>
      <div className="mb-6 space-y-2">
        {invites.map((inv) => (
          <div
            key={inv.org_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3"
          >
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 shrink-0 text-gold" />
              <span>
                <span className="font-medium">{inv.organizations?.name ?? "An organization"}</span>{" "}
                has invited you to join.
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming({ orgId: inv.org_id, action: "decline" })}
              >
                Decline
              </Button>
              <Button size="sm" onClick={() => setConfirming({ orgId: inv.org_id, action: "accept" })}>
                Accept
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirming?.action === "accept" ? "Join this organization?" : "Decline this invitation?"}
            </DialogTitle>
            <DialogDescription>
              {confirming?.action === "accept"
                ? `You'll gain access to ${confirmingInvite?.organizations?.name ?? "this organization"}'s data. Your other organizations are unaffected.`
                : `You won't be added to ${confirmingInvite?.organizations?.name ?? "this organization"}. They can invite you again later.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant={confirming?.action === "decline" ? "destructive" : "default"}
              disabled={isPending}
              onClick={() => {
                if (!confirming) return;
                if (confirming.action === "accept") accept.mutate(confirming.orgId);
                else decline.mutate(confirming.orgId);
              }}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirming?.action === "accept" ? "Accept" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
