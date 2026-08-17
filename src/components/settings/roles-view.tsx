"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, CheckSquare, Square } from "lucide-react";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  type OrgRoleWithPermissions,
  type PermissionKey,
} from "@/lib/types";
import { createRole, deleteRole, updateRolePermissions, renameRole } from "@/lib/actions/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const PERMISSION_GROUPS: { label: string; perms: PermissionKey[] }[] = [
  {
    label: "Projects",
    perms: ["view_projects", "create_projects", "edit_projects", "delete_projects"],
  },
  {
    label: "Companies",
    perms: ["view_companies", "create_companies", "edit_companies", "delete_companies"],
  },
  {
    label: "Contacts",
    perms: ["view_contacts", "create_contacts", "edit_contacts", "delete_contacts"],
  },
  {
    label: "Administration",
    perms: ["view_activity", "manage_members", "manage_roles"],
  },
];

export function RolesView({
  orgId,
  roles: initialRoles,
}: {
  orgId: string;
  roles: OrgRoleWithPermissions[];
}) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [selected, setSelected] = useState<OrgRoleWithPermissions | null>(
    initialRoles[0] ?? null
  );
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(
    new Set(initialRoles[0]?.permissions ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function selectRole(role: OrgRoleWithPermissions) {
    setSelected(role);
    setPermissions(new Set(role.permissions));
  }

  function togglePermission(p: PermissionKey) {
    setPermissions((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  const isAllSelected = ALL_PERMISSIONS.every((p) => permissions.has(p));

  function handleToggleSelectAll() {
    if (isAllSelected) {
      setPermissions(new Set());
    } else {
      setPermissions(new Set(ALL_PERMISSIONS));
    }
  }

  function toggleGroup(groupPerms: PermissionKey[]) {
    const isGroupAllSelected = groupPerms.every((p) => permissions.has(p));
    setPermissions((prev) => {
      const next = new Set(prev);
      if (isGroupAllSelected) {
        groupPerms.forEach((p) => next.delete(p));
      } else {
        groupPerms.forEach((p) => next.add(p));
      }
      return next;
    });
  }

  async function handleSavePermissions() {
    if (!selected) return;
    setSaving(true);
    try {
      await updateRolePermissions(selected.id, [...permissions]);
      setRoles((prev) =>
        prev.map((r) =>
          r.id === selected.id ? { ...r, permissions: [...permissions] } : r
        )
      );
      toast.success("Permissions saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      const role = await createRole(orgId, newRoleName.trim());
      const newRole = { ...role, permissions: [] as PermissionKey[] };
      setRoles((prev) => [...prev, newRole]);
      setSelected(newRole);
      setPermissions(new Set());
      setCreateOpen(false);
      setNewRoleName("");
      toast.success(`Role "${role.name}" created`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDeleteRole() {
    if (!deleteId) return;
    try {
      await deleteRole(deleteId);
      const remaining = roles.filter((r) => r.id !== deleteId);
      setRoles(remaining);
      if (selected?.id === deleteId) {
        setSelected(remaining[0] ?? null);
        setPermissions(new Set(remaining[0]?.permissions ?? []));
      }
      setDeleteId(null);
      toast.success("Role deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <div className="flex gap-6">
        {/* Role list sidebar */}
        <div className="w-52 shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Roles
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              title="Add role"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles yet.</p>
          ) : (
            <ul className="space-y-1">
              {roles.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => selectRole(r)}
                    className={`group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-left transition-colors ${
                      selected?.id === r.id
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(r.id);
                      }}
                      className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Permissions matrix */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border">
              <p className="text-sm text-muted-foreground">Select or create a role to configure its permissions.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <p className="font-medium">{selected.name}</p>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                    {permissions.size} of {ALL_PERMISSIONS.length} permissions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleSelectAll}
                  >
                    {isAllSelected ? "Deselect all" : "Select all"}
                  </Button>
                  <Button size="sm" onClick={handleSavePermissions} disabled={saving}>
                    {saving ? "Saving…" : "Save permissions"}
                  </Button>
                </div>
              </div>

              <div className="divide-y divide-border">
                {PERMISSION_GROUPS.map((group) => {
                  const isGroupAllSelected = group.perms.every((p) => permissions.has(p));
                  return (
                    <div key={group.label} className="px-4 py-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.label}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.perms)}
                          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {isGroupAllSelected ? "Deselect category" : "Select category"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {group.perms.map((p) => {
                          const checked = permissions.has(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => togglePermission(p)}
                              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-left transition-colors hover:bg-secondary/50"
                            >
                              {checked ? (
                                <CheckSquare className="h-4 w-4 shrink-0 text-gold" />
                              ) : (
                                <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              <span className={checked ? "text-foreground" : "text-muted-foreground"}>
                                {PERMISSION_LABELS[p]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create role dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRole} className="space-y-4">
            <Input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. Sales Manager"
              required
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newRoleName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete role?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Members assigned to this role will lose their custom role. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRole}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
