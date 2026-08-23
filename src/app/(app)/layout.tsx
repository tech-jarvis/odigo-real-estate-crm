import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { RoleProvider } from "@/components/shared/role-context";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentProfile();

  if (!current) redirect("/login");

  // Super admins have their own layout — don't load the regular app shell.
  if (current.profile.is_super_admin) redirect("/super-admin/organizations");

  // First-login password change — outside (app) so no redirect loop.
  if (current.profile.must_change_password) redirect("/change-password");

  if (!current.currentOrgId) redirect("/no-organization");

  return (
    <RoleProvider current={current}>
      <AppShell
        memberships={current.memberships}
        currentOrgId={current.currentOrgId}
        pendingInvites={current.pendingInvites}
      >
        {children}
      </AppShell>
    </RoleProvider>
  );
}
