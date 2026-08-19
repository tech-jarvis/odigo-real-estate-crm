import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { Logo } from "@/components/shared/logo";
import { createClient } from "@/lib/supabase/server";

export default async function NoOrganizationPage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  // If they do belong to an org (or are a super admin), this page doesn't apply.
  if (current.profile.is_super_admin) redirect("/super-admin/organizations");
  if (current.currentOrgId) redirect("/");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <Logo />
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">No active organization</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          You&apos;re not currently a member of any organization. Ask an admin to invite you, or
          check back if you were recently removed.
        </p>
        <form
          action={async () => {
            "use server";
            const supabase = await createClient();
            await supabase.auth.signOut();
            redirect("/login");
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
