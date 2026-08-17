"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserX, UserPlus, Eye, EyeOff, RefreshCw } from "lucide-react";
import type { Organization, Profile, UserRole } from "@/lib/types";
import { createOrgMember, removeOrgMember } from "@/lib/actions/super-admin";
import { isValidEmail, normalizeEmail } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function OrgDetailView({
  org,
  members,
}: {
  org: Organization;
  members: Profile[];
}) {
  const router = useRouter();

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Add member form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [tempPassword, setTempPassword] = useState(generatePassword);
  const [showPassword, setShowPassword] = useState(false);
  const [adding, setAdding] = useState(false);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !tempPassword) return;
    if (!isValidEmail(email)) {
      toast.error("Invalid email address", {
        description: "Please enter a valid email address.",
      });
      return;
    }
    setAdding(true);
    try {
      await createOrgMember(org.id, normalizeEmail(email), tempPassword, role);
      toast.success(`Account created for ${email.trim()}. Share the credentials with them.`);
      setEmail("");
      setRole("viewer");
      setTempPassword(generatePassword());
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove() {
    if (!removingId) return;
    setRemoving(true);
    try {
      await removeOrgMember(removingId, org.id);
      toast.success("Member removed from organization");
      setRemovingId(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      {/* Add member form */}
      <form
        onSubmit={handleAddMember}
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
          <div className="w-32">
            <label className="mb-1.5 block text-xs text-muted-foreground">Role</label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs text-muted-foreground">Temporary password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                required
                className="h-9 pr-9 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setTempPassword(generatePassword())}
            title="Generate password"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button type="submit" disabled={adding || !email.trim()} className="h-9 gap-1.5">
            <UserPlus className="h-4 w-4" />
            {adding ? "Creating…" : "Create account"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The user will be prompted to change this password on first login.
        </p>
      </form>

      {/* Members table */}
      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No members yet. Use the form above to create an account.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-secondary/20 border-b border-border">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Members ({members.length})
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/10">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{m.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.role === "admin"
                          ? "bg-gold/10 text-gold"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString()}
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
                      title="Remove member"
                    >
                      <UserX className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Remove confirm dialog */}
      <Dialog open={!!removingId} onOpenChange={() => setRemovingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              This user will lose access to the organization. Their account will remain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRemovingId(null)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
