import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listRoles } from "@/lib/actions/roles";
import { RolesView } from "@/components/settings/roles-view";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
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

  const roles = await listRoles(current.currentOrgId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Roles & Permissions</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Define custom roles and control what each role can access.
        </p>
      </div>

      <RolesView orgId={current.currentOrgId} roles={roles} />
    </div>
  );
}
