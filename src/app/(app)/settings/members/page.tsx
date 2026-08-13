import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listMembers } from "@/lib/actions/members";
import { listRoles } from "@/lib/actions/roles";
import { MembersView } from "@/components/settings/members-view";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && !profile.is_super_admin) redirect("/");
  if (!profile.org_id) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Your account is not assigned to an organization.
      </div>
    );
  }

  const [members, roles] = await Promise.all([
    listMembers(profile.org_id),
    listRoles(profile.org_id),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Members</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage who has access to your organization.
        </p>
      </div>

      <MembersView
        orgId={profile.org_id}
        members={members}
        roles={roles}
      />
    </div>
  );
}
