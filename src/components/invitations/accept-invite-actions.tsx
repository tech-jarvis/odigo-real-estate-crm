"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { acceptInvitation, declineInvitation } from "@/lib/actions/invitations";
import { Button } from "@/components/ui/button";

export function AcceptInviteActions({
  token,
  orgName,
}: {
  token: string;
  orgName: string;
}) {
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

  async function handleAccept() {
    setLoading("accept");
    const res = await acceptInvitation(token);
    setLoading(null);
    setResult(
      "error" in res
        ? { type: "error", message: res.error }
        : {
            type: "success",
            message: `You've joined ${res.orgName}. Head to the dashboard to get started.`,
          }
    );
  }

  async function handleDecline() {
    setLoading("decline");
    const res = await declineInvitation(token);
    setLoading(null);
    setResult(
      "error" in res
        ? { type: "error", message: res.error }
        : { type: "success", message: `You've declined the invitation to join ${res.orgName}.` }
    );
  }

  if (result) {
    return (
      <>
        {result.type === "success" ? (
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
        ) : (
          <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
        )}
        <p className="text-sm text-muted-foreground">{result.message}</p>
        {result.type === "success" && (
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

  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{orgName}</span> has invited you to join
        their organization. You&apos;re already active in another organization — accepting adds{" "}
        {orgName} to your account without affecting your other organization.
      </p>
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={handleDecline} disabled={loading !== null}>
          {loading === "decline" ? "Declining…" : "Decline"}
        </Button>
        <Button onClick={handleAccept} disabled={loading !== null}>
          {loading === "accept" ? "Accepting…" : "Accept"}
        </Button>
      </div>
    </>
  );
}
