import Link from "next/link";
import { Plus } from "lucide-react";
import { listOrganizations } from "@/lib/actions/super-admin";
import { OrgTable } from "@/components/super-admin/org-table";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  const orgs = await listOrganizations();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Organizations</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {orgs.length} organization{orgs.length !== 1 ? "s" : ""} on the platform
          </p>
        </div>
        <Link
          href="/super-admin/organizations/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New organization
        </Link>
      </div>

      <OrgTable orgs={orgs} />
    </div>
  );
}
