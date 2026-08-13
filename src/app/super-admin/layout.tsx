import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, LogOut } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { Logo } from "@/components/shared/logo";
import { createClient } from "@/lib/supabase/server";

async function SuperAdminNav() {
  return (
    <aside className="sticky top-0 flex h-screen w-[240px] flex-col border-r border-border bg-card/40 p-4">
      <div className="px-2 py-3">
        <Logo />
        <span className="mt-1 block px-2 text-[10px] font-semibold uppercase tracking-widest text-gold/70">
          Super Admin
        </span>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-1">
        <Link
          href="/super-admin/organizations"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
        >
          <Building2 className="h-4 w-4" />
          Organizations
        </Link>
      </nav>

      <SignOutButton />
    </aside>
  );
}

function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        const supabase = await createClient();
        await supabase.auth.signOut();
        redirect("/login");
      }}
    >
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </form>
  );
}

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile || !profile.is_super_admin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen lg:flex">
      <SuperAdminNav />
      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
