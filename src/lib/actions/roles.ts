"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgRole, OrgRoleWithPermissions, PermissionKey } from "@/lib/types";

export async function listRoles(orgId: string): Promise<OrgRoleWithPermissions[]> {
  const { supabase } = await requireOrgAdmin();

  const { data: roles, error } = await supabase
    .from("org_roles")
    .select("*, role_permissions(permission)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (roles ?? []).map((r) => ({
    id: r.id,
    org_id: r.org_id,
    name: r.name,
    created_at: r.created_at,
    permissions: (r.role_permissions ?? []).map(
      (p: { permission: PermissionKey }) => p.permission
    ),
  }));
}

export async function createRole(orgId: string, name: string): Promise<OrgRole> {
  await requireOrgAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("org_roles")
    .insert({ org_id: orgId, name: name.trim() })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/settings/roles");
  return data;
}

export async function deleteRole(roleId: string): Promise<void> {
  await requireOrgAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("org_roles").delete().eq("id", roleId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/roles");
}

export async function updateRolePermissions(
  roleId: string,
  permissions: PermissionKey[]
): Promise<void> {
  await requireOrgAdmin();
  const admin = createAdminClient();

  // Replace all permissions for this role atomically
  const { error: delErr } = await admin
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId);

  if (delErr) throw new Error(delErr.message);

  if (permissions.length > 0) {
    const rows = permissions.map((permission) => ({ role_id: roleId, permission }));
    const { error: insErr } = await admin.from("role_permissions").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }

  revalidatePath("/settings/roles");
}

export async function renameRole(roleId: string, name: string): Promise<void> {
  await requireOrgAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("org_roles")
    .update({ name: name.trim() })
    .eq("id", roleId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/roles");
}
