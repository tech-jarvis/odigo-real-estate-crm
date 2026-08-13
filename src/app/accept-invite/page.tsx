import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { acceptInvitation } from "@/lib/actions/invitations";
import { Logo } from "@/components/shared/logo";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <Result type="error" message="Missing invitation token." />;
  }

  const result = await acceptInvitation(token);

  if ("error" in result) {
    if (result.error === "You must be signed in to accept an invitation.") {
      redirect(`/login?next=/accept-invite?token=${token}`);
    }
    return <Result type="error" message={result.error} />;
  }

  return (
    <Result
      type="success"
      message={`You've joined ${result.orgName}. Head to the dashboard to get started.`}
    />
  );
}

function Result({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <Logo />
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        {type === "success" ? (
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
        ) : (
          <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
        )}
        <p className="text-sm text-muted-foreground">{message}</p>
        {type === "success" && (
          <a
            href="/"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to dashboard
          </a>
        )}
      </div>
    </div>
  );
}
