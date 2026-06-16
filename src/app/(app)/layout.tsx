import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { RoleProvider } from "@/components/shared/role-context";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  // Middleware already guards this, but we double-check at the layer that
  // actually reads the role — defence in depth.
  if (!profile) redirect("/login");

  return (
    <RoleProvider profile={profile}>
      <AppShell>{children}</AppShell>
    </RoleProvider>
  );
}
