# Role & Invitation Flow Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the org/role/invitation hierarchy so: Superadmin creates org + Admin account → org auto-gets Admin & Viewer roles → Admin invites users without manual role setup → no hierarchy bypasses.

**Architecture:** All enforcement is layered: DB migration ensures `cancelled_at` column exists; application-level `createOrganization` seeds default roles and links the admin profile; server action guards (`requireOrgAdmin`) block super-admin passthrough; UI removes the superadmin "add member" form; settings page guards are tightened.

**Tech Stack:** Next.js 15 App Router, Supabase (postgres + RLS + admin client), TypeScript server actions.

---

## Bug Inventory (for reference)

| # | Bug | File | Severity |
|---|-----|------|----------|
| 1 | No default org roles seeded on org creation | `super-admin.ts` | Critical |
| 2 | Admin profile `org_role_id` not set after org creation | `super-admin.ts` | Critical |
| 3 | Superadmin can add Viewer/Admin members from org-detail page | `org-detail-view.tsx` | Violation |
| 4 | `requireOrgAdmin` passes super admins (null org_id) | `members.ts`, `roles.ts` | Security |
| 5 | Settings pages allow super admins through explicitly | `settings/members/page.tsx`, `settings/roles/page.tsx` | Minor |
| 6 | `cancelled_at` column missing from SQL migration but present in code/types | migration gap | Minor |

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/17_fix_invitations.sql` | Ensure `cancelled_at` column exists (idempotent) |
| Modify | `src/lib/actions/super-admin.ts` | Seed default roles + link admin profile; remove `createOrgMember` export |
| Modify | `src/components/super-admin/org-detail-view.tsx` | Remove "Add member" form; read-only member list |
| Modify | `src/lib/actions/members.ts` | Remove `is_super_admin` bypass from `requireOrgAdmin` |
| Modify | `src/lib/actions/roles.ts` | Remove `is_super_admin` bypass from `requireOrgAdmin` |
| Modify | `src/app/(app)/settings/members/page.tsx` | Remove `!profile.is_super_admin` from page guard |
| Modify | `src/app/(app)/settings/roles/page.tsx` | Remove `!profile.is_super_admin` from page guard |

---

### Task 1: Add SQL migration 17 — ensure `cancelled_at` column exists

**Files:**
- Create: `supabase/17_fix_invitations.sql`

The `invitations` table schema (migration 14) is missing the `cancelled_at` column that is referenced in both `database.types.ts` and `src/lib/actions/members.ts`. This migration adds it idempotently.

- [ ] **Step 1: Write the migration**

Create `supabase/17_fix_invitations.sql` with the following content:

```sql
-- Migration 17: Ensure invitations.cancelled_at column exists
-- The column is referenced in application code and database.types.ts
-- but was not included in the original migration 14.

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
```

- [ ] **Step 2: Verify the build still passes**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm && npm run build
```

Expected: Clean build, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/17_fix_invitations.sql
git commit -m "feat: add migration 17 to ensure invitations.cancelled_at column exists"
```

---

### Task 2: Seed default roles in `createOrganization` and link admin profile

**Files:**
- Modify: `src/lib/actions/super-admin.ts`

**What changes:**
1. After creating the org + auth user, insert `Admin` org role (all 15 permissions) and `Viewer` org role (4 view permissions).
2. Assign the admin profile's `org_role_id` to the newly created Admin role.
3. Remove the `createOrgMember` export entirely (superadmin should not add org-level users after org creation).

Admin role default permissions: all 15 (`view_projects`, `create_projects`, `edit_projects`, `delete_projects`, `archive_projects`, `view_companies`, `create_companies`, `edit_companies`, `delete_companies`, `archive_companies`, `view_contacts`, `create_contacts`, `edit_contacts`, `delete_contacts`, `archive_contacts`, `view_activity`, `manage_members`, `manage_roles`).

Wait — the DB enum has 15 values + 3 archive values from migration 16. The complete set is:
- From migration 14: `view_projects`, `create_projects`, `edit_projects`, `delete_projects`, `view_companies`, `create_companies`, `edit_companies`, `delete_companies`, `view_contacts`, `create_contacts`, `edit_contacts`, `delete_contacts`, `view_activity`, `manage_members`, `manage_roles` (15 values)
- From migration 16 ALTER TYPE: `archive_projects`, `archive_companies`, `archive_contacts` (3 more = 18 total)

Viewer role default permissions: `view_projects`, `view_companies`, `view_contacts`, `view_activity` (4 read-only values).

- [ ] **Step 1: Read the current file**

```bash
cat /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm/src/lib/actions/super-admin.ts
```

(Confirm you're seeing the current version before editing)

- [ ] **Step 2: Replace `createOrganization` and remove `createOrgMember`**

Replace the entire `createOrganization` function and remove `createOrgMember`. The new file content from line 79 onwards (everything from `export async function createOrganization` to the end of `createOrgMember`) should be:

```typescript
const ADMIN_PERMISSIONS = [
  "view_projects", "create_projects", "edit_projects", "delete_projects", "archive_projects",
  "view_companies", "create_companies", "edit_companies", "delete_companies", "archive_companies",
  "view_contacts", "create_contacts", "edit_contacts", "delete_contacts", "archive_contacts",
  "view_activity", "manage_members", "manage_roles",
] as const;

const VIEWER_PERMISSIONS = [
  "view_projects", "view_companies", "view_contacts", "view_activity",
] as const;

export async function createOrganization(
  name: string,
  adminEmail: string,
  tempPassword: string
): Promise<{ org: Organization }> {
  if (!isValidEmail(adminEmail)) {
    throw new Error("Invalid admin email address format");
  }
  const cleanEmail = normalizeEmail(adminEmail);
  await requireSuperAdmin();
  const admin = createAdminClient();

  const slug = slugify(name);

  // 1. Create the organization
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name, slug })
    .select()
    .single();

  if (orgErr) throw new Error(orgErr.message);

  // 2. Create auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
  });

  if (authErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    throw new Error(authErr.message);
  }

  const userId = authData.user.id;

  // 3. Seed default org roles
  const { data: adminRole, error: adminRoleErr } = await admin
    .from("org_roles")
    .insert({ org_id: org.id, name: "Admin" })
    .select("id")
    .single();

  if (adminRoleErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    throw new Error(adminRoleErr.message);
  }

  const { data: viewerRole, error: viewerRoleErr } = await admin
    .from("org_roles")
    .insert({ org_id: org.id, name: "Viewer" })
    .select("id")
    .single();

  if (viewerRoleErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    throw new Error(viewerRoleErr.message);
  }

  // 4. Seed permissions for Admin role (full access)
  const adminPermRows = ADMIN_PERMISSIONS.map((permission) => ({
    role_id: adminRole.id,
    permission,
  }));
  await admin.from("role_permissions").insert(adminPermRows);

  // 5. Seed permissions for Viewer role (read-only)
  const viewerPermRows = VIEWER_PERMISSIONS.map((permission) => ({
    role_id: viewerRole.id,
    permission,
  }));
  await admin.from("role_permissions").insert(viewerPermRows);

  // 6. Create admin profile, linked to org and Admin org role
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: cleanEmail,
        org_id: org.id,
        role: "admin",
        org_role_id: adminRole.id,
        must_change_password: true,
      },
      { onConflict: "id" }
    );

  if (profileErr) throw new Error(profileErr.message);

  revalidatePath("/super-admin/organizations");
  return { org };
}
```

Also remove the `createOrgMember` function and its export entirely (lines from `export async function createOrgMember` to the end of that function). Keep `removeOrgMember`, `deleteOrganization`, and all the other functions.

Remove `UserRole` from the import at the top since it's no longer needed:
```typescript
import type { Organization, OrgWithCount, Profile } from "@/lib/types";
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm && npm run build
```

Expected: Clean build. If TypeScript complains about `UserRole` still being imported, remove it from the import line.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/super-admin.ts
git commit -m "feat: seed default Admin/Viewer org roles on organization creation and link admin profile"
```

---

### Task 3: Make org-detail view read-only (remove "Add member" form)

**Files:**
- Modify: `src/components/super-admin/org-detail-view.tsx`

Remove the "Add member" form, its state, and the `createOrgMember` import. Keep the members table and the remove-member dialog. The resulting component only shows the members list and allows removal.

- [ ] **Step 1: Read the current file**

```bash
cat /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm/src/components/super-admin/org-detail-view.tsx
```

- [ ] **Step 2: Replace the entire file**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserX } from "lucide-react";
import type { Organization, Profile } from "@/lib/types";
import { removeOrgMember } from "@/lib/actions/super-admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No members yet. The Admin account will appear here after first login.
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
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm && npm run build
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/super-admin/org-detail-view.tsx
git commit -m "feat: make org-detail view read-only for superadmin — remove add-member form"
```

---

### Task 4: Tighten `requireOrgAdmin` guards in server actions

**Files:**
- Modify: `src/lib/actions/members.ts`
- Modify: `src/lib/actions/roles.ts`

Currently both files let super admins bypass the org-admin check. Super admins have a null `org_id`, so letting them through causes silent data corruption. They should use their own super-admin actions instead.

- [ ] **Step 1: Fix `members.ts` — remove super admin bypass**

In `src/lib/actions/members.ts`, find the `requireOrgAdmin` function. The current check:

```typescript
  if (profile.role !== "admin" && !profile.is_super_admin) {
    throw new Error("Forbidden — admin only");
  }
  if (!profile.org_id && !profile.is_super_admin) {
    throw new Error("No organization assigned");
  }
```

Replace with:

```typescript
  if (profile.role !== "admin") {
    throw new Error("Forbidden — admin only");
  }
  if (!profile.org_id) {
    throw new Error("No organization assigned");
  }
```

Also update the select query in `requireOrgAdmin` — since we no longer check `is_super_admin`, we don't need to select it:

```typescript
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .single();
```

- [ ] **Step 2: Fix `roles.ts` — remove super admin bypass**

In `src/lib/actions/roles.ts`, find the `requireOrgAdmin` function. The current check:

```typescript
  if (profile.role !== "admin" && !profile.is_super_admin) {
    throw new Error("Forbidden — admin only");
  }
```

Replace with:

```typescript
  if (profile.role !== "admin") {
    throw new Error("Forbidden — admin only");
  }
```

Also update the select query to not select `is_super_admin`:

```typescript
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .single();
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm && npm run build
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/members.ts src/lib/actions/roles.ts
git commit -m "fix: remove superadmin bypass from requireOrgAdmin guards in members and roles actions"
```

---

### Task 5: Remove super admin bypass from settings page guards

**Files:**
- Modify: `src/app/(app)/settings/members/page.tsx`
- Modify: `src/app/(app)/settings/roles/page.tsx`

Super admins are already redirected to `/super-admin/organizations` at the `/(app)/layout.tsx` level. The `!profile.is_super_admin` exception in these page guards is therefore dead code that creates a defence gap.

- [ ] **Step 1: Fix `settings/members/page.tsx`**

Find:
```typescript
  if (profile.role !== "admin" && !profile.is_super_admin) redirect("/");
```

Replace with:
```typescript
  if (profile.role !== "admin") redirect("/");
```

- [ ] **Step 2: Fix `settings/roles/page.tsx`**

Find:
```typescript
  if (profile.role !== "admin" && !profile.is_super_admin) redirect("/");
```

Replace with:
```typescript
  if (profile.role !== "admin") redirect("/");
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm && npm run build
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/settings/members/page.tsx src/app/\(app\)/settings/roles/page.tsx
git commit -m "fix: remove superadmin bypass from settings page guards — layout redirect is the authority"
```

---

### Task 6: Push, apply migration 17, and deploy

- [ ] **Step 1: Push all commits**

```bash
git push origin master
```

- [ ] **Step 2: Apply migration 17 to Supabase**

Run the migration SQL against the production Supabase project. The SQL to run in the Supabase SQL editor (or via CLI):

```sql
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
```

Navigate to the Supabase dashboard → SQL Editor → paste and run. Or via CLI:
```bash
supabase db push
```

- [ ] **Step 3: Deploy to Vercel**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm && vercel --prod
```

Expected: Production deploy URL printed. Deployment state = READY.

- [ ] **Step 4: Smoke test the complete flow**

Test sequence:
1. Login as `superadmin@odigo.com` → should land on `/super-admin/organizations`
2. Create a new org with a fresh admin email → verify no "Add member" form appears on org detail page
3. Login as the new admin → must-change-password prompt → change password → lands on Dashboard
4. Navigate to Settings → Members → should see the Add member form (no "No roles defined yet" warning)
5. In the Role dropdown, verify "Admin" and "Viewer" are present without manually creating them
6. Create a member with the Admin role → verify account is created
7. Create a member with the Viewer role → verify account is created
8. Login as each new member → verify they land on the correct dashboard
9. Verify superadmin cannot navigate to `/settings/members` — should redirect to `/super-admin/organizations`

---

## Self-Review Checklist

- [x] **Spec coverage:** All 10 test-flow items from the spec are covered by Tasks 2–6.
- [x] **Hierarchy enforced at data layer:** `requireOrgAdmin` strips super admin bypass; settings pages strip super admin bypass; org-detail has no add-member form.
- [x] **No duplicate roles:** `unique(org_id, name)` constraint in DB + seeding via insert (not upsert) means a second "Admin" role would fail at DB level.
- [x] **Invitation role assignment:** `crmRoleFromOrgRole` checks `manage_members` permission → Admin org role gets `manage_members` in Task 2 seeding → invited Admin users correctly get CRM role `admin`.
- [x] **Viewer continues to work:** Viewer org role is seeded with view-only permissions; `crmRoleFromOrgRole` returns `viewer` when `manage_members` is absent.
- [x] **No new features added:** Only fixes applied. `cancelInvitation` still deletes rows (no change to semantics). Soft-cancel via `cancelled_at` not implemented (YAGNI — cancel-by-delete is correct and the filter in `inviteMember` still works since all non-deleted rows have `cancelled_at = NULL` once column is added).
- [x] **Migration is idempotent:** `IF NOT EXISTS` in migration 17.
