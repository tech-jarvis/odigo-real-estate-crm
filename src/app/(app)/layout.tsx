import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RoleProvider } from "@/components/shared/role-context";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  // Super admins have their own layout — don't load the regular app shell.
  if (profile.is_super_admin) redirect("/super-admin/organizations");

  // First-login password change — outside (app) so no redirect loop.
  if (profile.must_change_password) redirect("/change-password");

  let orgName: string | null = null;
  if (profile.org_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.org_id)
      .single();
    orgName = data?.name ?? null;
  }

  return (
    <RoleProvider profile={profile}>
      <AppShell orgName={orgName}>{children}</AppShell>
    </RoleProvider>
  );
}
