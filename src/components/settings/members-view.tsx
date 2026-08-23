"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, RefreshCw, UserPlus, AlertCircle, Clock, X, Loader2 } from "lucide-react";
import {
  cancelInvitation,
  checkMemberEmailExists,
  createMemberWithPassword,
  listMembers,
  listPendingInvitations,
  removeMember,
} from "@/lib/actions/members";
import { listRoles } from "@/lib/actions/roles";
import { isValidEmail, normalizeEmail } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function FormSkeleton() {
  return (
    <div className="mb-6 space-y-3 rounded-lg border border-border bg-secondary/10 p-4">
      <Skeleton className="h-3 w-24" />
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-44" />
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export function MembersView({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();

  const {
    data: members = [],
    isLoading: membersLoading,
    error: membersError,
  } = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => listMembers(orgId),
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["orgRoles", orgId],
    queryFn: () => listRoles(orgId),
  });

  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ["pendingInvitations", orgId],
    queryFn: () => listPendingInvitations(orgId),
  });

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Add member form
  const [email, setEmail] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [orgRoleId, setOrgRoleId] = useState("");
  const [tempPassword, setTempPassword] = useState(generatePassword);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedEmail(email.trim()), 400);
    return () => clearTimeout(timer);
  }, [email]);

  const { data: emailExists = false } = useQuery({
    queryKey: ["memberEmailExists", debouncedEmail],
    queryFn: () => checkMemberEmailExists(debouncedEmail),
    enabled: isValidEmail(debouncedEmail),
    staleTime: 60 * 1000,
  });

  const addMember = useMutation({
    mutationFn: () => createMemberWithPassword(normalizeEmail(email), orgRoleId, tempPassword),
    onSuccess: (result) => {
      if (result.status === "pending_existing_user") {
        toast.success(`${email.trim()} has been invited to your organization.`);
      } else {
        toast.success(`Account created for ${email.trim()}. Share the credentials with them.`);
      }
      setEmail("");
      setOrgRoleId("");
      setTempPassword(generatePassword());
      queryClient.invalidateQueries({ queryKey: ["members", orgId] });
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations", orgId] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeMember(userId),
    onSuccess: () => {
      toast.success("Member removed");
      setRemovingId(null);
      queryClient.invalidateQueries({ queryKey: ["members", orgId] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => cancelInvitation(invitationId),
    onSuccess: () => {
      toast.success("Invitation cancelled");
      setCancellingId(null);
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations", orgId] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  function roleName(id: string | null) {
    if (!id) return null;
    return roles.find((r) => r.id === id)?.name ?? null;
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!orgRoleId || !email.trim()) return;
    if (!isValidEmail(email)) {
      toast.error("Invalid email address", {
        description: "Please enter a valid email address.",
      });
      return;
    }
    addMember.mutate();
  }

  if (membersError) {
    return (
      <ErrorState
        message="Could not load members."
        onRetry={() => queryClient.invalidateQueries({ queryKey: ["members", orgId] })}
      />
    );
  }

  return (
    <>
      {/* Add member form */}
      {rolesLoading ? (
        <FormSkeleton />
      ) : roles.length === 0 ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-secondary/10 p-4">
          <AlertCircle className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
          <p className="text-sm text-muted-foreground">
            No roles defined yet. Go to{" "}
            <a href="/settings/roles" className="text-foreground underline">
              Settings → Roles
            </a>{" "}
            to create roles before adding members.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleAdd}
          className="mb-6 rounded-lg border border-border bg-secondary/10 p-4 space-y-3"
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Add member
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs text-muted-foreground">Email</label>
              <Input
                type="email"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="w-44">
              <label className="mb-1.5 block text-xs text-muted-foreground">Role</label>
              <Select value={orgRoleId} onValueChange={setOrgRoleId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs text-muted-foreground">
                Temporary password
              </label>
              <PasswordInput
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                required={!emailExists}
                disabled={emailExists}
                className="h-9 font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setTempPassword(generatePassword())}
              disabled={emailExists}
              title="Generate password"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="submit"
              disabled={addMember.isPending || !email.trim() || !orgRoleId}
              className="h-9 gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              {addMember.isPending ? "Adding…" : emailExists ? "Invite to organization" : "Create account"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {emailExists
              ? "This person already has an account — no password needed, they'll receive an invitation to accept."
              : "The member will be prompted to change this password on first login."}
          </p>
        </form>
      )}

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <div className="mb-6 rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-secondary/20 border-b border-border">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pending invitations ({pendingInvitations.length})
            </p>
          </div>
          <ul>
            {pendingInvitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>{inv.email}</span>
                  <span className="text-xs text-muted-foreground">
                    · expires {new Date(inv.expires_at).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => setCancellingId(inv.id)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Cancel invitation"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Members table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-secondary/20 border-b border-border">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Members ({members.length})
          </p>
        </div>
        {membersLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/10">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const name = roleName(m.org_role_id);
                return (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{m.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3">
                      {name ? (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gold/10 text-gold">
                          {name}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-muted-foreground">
                          {m.role === "admin" ? "Admin" : "Viewer"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.must_change_password ? (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-400/10 text-amber-400">
                          Awaiting login
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-400/10 text-emerald-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setRemovingId(m.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Remove member confirm dialog */}
      <Dialog open={!!removingId} onOpenChange={(open) => !open && setRemovingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              They will lose access to this organization. Their account will remain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={removeMemberMutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => removingId && removeMemberMutation.mutate(removingId)}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel invitation confirm dialog */}
      <Dialog open={!!cancellingId} onOpenChange={(open) => !open && setCancellingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel this invitation?</DialogTitle>
            <DialogDescription>
              They will no longer be able to accept it. You can invite them again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={cancelInvitationMutation.isPending}>
                Keep invitation
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => cancellingId && cancelInvitationMutation.mutate(cancellingId)}
              disabled={cancelInvitationMutation.isPending}
            >
              {cancelInvitationMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
