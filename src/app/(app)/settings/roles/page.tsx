import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listRoles } from "@/lib/actions/roles";
import { RolesView } from "@/components/settings/roles-view";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  if (!profile.org_id) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Your account is not assigned to an organization.
      </div>
    );
  }

  const roles = await listRoles(profile.org_id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Roles & Permissions</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Define custom roles and control what each role can access.
        </p>
      </div>

      <RolesView orgId={profile.org_id} roles={roles} />
    </div>
  );
}
