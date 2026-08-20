import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listMembers, listPendingInvitations } from "@/lib/actions/members";
import { listRoles } from "@/lib/actions/roles";
import { MembersView } from "@/components/settings/members-view";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  if (current.currentRole !== "admin") redirect("/");
  if (!current.currentOrgId) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Your account is not assigned to an organization.
      </div>
    );
  }

  const [members, roles, pendingInvitations] = await Promise.all([
    listMembers(current.currentOrgId),
    listRoles(current.currentOrgId),
    listPendingInvitations(current.currentOrgId),
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
        orgId={current.currentOrgId}
        members={members}
        roles={roles}
        pendingInvitations={pendingInvitations}
      />
    </div>
  );
}
