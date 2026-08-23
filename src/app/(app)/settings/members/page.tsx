import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { MembersView } from "@/components/settings/members-view";

export const dynamic = "force-dynamic";

// No data-fetching here — MembersView loads members/roles/invitations
// client-side via React Query so mutations can invalidate + refetch
// without a full server round-trip.
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Members</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage who has access to your organization.
        </p>
      </div>

      <MembersView orgId={current.currentOrgId} />
    </div>
  );
}
