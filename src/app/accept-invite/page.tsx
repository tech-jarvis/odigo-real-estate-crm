import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { acceptInvitation, previewInvitation } from "@/lib/actions/invitations";
import { Logo } from "@/components/shared/logo";
import { AcceptInviteActions } from "@/components/invitations/accept-invite-actions";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Shell>
        <Result type="error" message="Missing invitation token." />
      </Shell>
    );
  }

  const preview = await previewInvitation(token);

  if ("error" in preview) {
    return (
      <Shell>
        <Result type="error" message={preview.error} />
      </Shell>
    );
  }

  if ("requiresSignIn" in preview) {
    redirect(`/login?next=/accept-invite?token=${token}`);
  }

  // Brand-new / first-ever org: keep today's frictionless auto-accept.
  if (!preview.hasOtherOrgs) {
    const result = await acceptInvitation(token);
    return (
      <Shell>
        {"error" in result ? (
          <Result type="error" message={result.error} />
        ) : (
          <Result
            type="success"
            message={`You've joined ${result.orgName}. Head to the dashboard to get started.`}
          />
        )}
      </Shell>
    );
  }

  // Existing user with another active org — require an explicit choice
  // rather than silently pulling them into a second org's data.
  return (
    <Shell>
      <AcceptInviteActions token={token} orgName={preview.orgName} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <Logo />
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Result({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <>
      {type === "success" ? (
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
      ) : (
        <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
      )}
      <p className="text-sm text-muted-foreground">{message}</p>
      {type === "success" && (
        <Link
          href="/"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to dashboard
        </Link>
      )}
    </>
  );
}
