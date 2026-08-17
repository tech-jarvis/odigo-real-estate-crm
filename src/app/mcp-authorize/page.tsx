"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/logo";
import { isValidEmail, normalizeEmail } from "@/lib/utils";

type Step = "loading" | "login" | "authorize" | "redirecting" | "error";

function getPlatformName(redirectUri: string): string {
  if (!redirectUri) return "Claude";
  try {
    const url = new URL(redirectUri);
    if (url.hostname.includes("chatgpt.com")) return "ChatGPT";
    if (url.hostname.includes("claude.ai")) return "Claude";
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return "Claude Desktop";
  } catch {
    // Invalid URL, fall back to default
  }
  return "Claude";
}

function McpAuthorizeContent() {
  const params = useSearchParams();
  const redirectUri = params.get("redirect_uri") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const state = params.get("state") ?? "";
  const platform = getPlatformName(redirectUri);

  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [tokens, setTokens] = useState<{
    access: string;
    refresh: string;
  } | null>(null);

  const mcpUrl = (
    process.env.NEXT_PUBLIC_MCP_URL ?? "http://localhost:3001"
  ).replace(/\/$/, "");

  useEffect(() => {
    if (!redirectUri || !codeChallenge) {
      setErrorMsg("Missing OAuth parameters. Please try connecting again.");
      setStep("error");
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setTokens({
          access: session.access_token,
          refresh: session.refresh_token,
        });
        setUserEmail(session.user.email ?? null);
        setStep("authorize");
      } else {
        setStep("login");
      }
    });
  }, [redirectUri, codeChallenge]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error || !data.session) {
      setErrorMsg(error?.message ?? "Login failed");
      setBusy(false);
      return;
    }
    setTokens({
      access: data.session.access_token,
      refresh: data.session.refresh_token,
    });
    setUserEmail(data.session.user.email ?? null);
    setStep("authorize");
    setBusy(false);
  }

  async function handleAuthorize() {
    if (!tokens) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${mcpUrl}/complete-authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabase_access_token: tokens.access,
          supabase_refresh_token: tokens.refresh,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          state,
        }),
      });
      const json = (await res.json()) as {
        redirect_to?: string;
        error?: string;
        error_description?: string;
      };
      if (!res.ok || !json.redirect_to) {
        setErrorMsg(
          json.error_description ?? json.error ?? "Authorization failed"
        );
        setBusy(false);
        return;
      }
      setStep("redirecting");
      window.location.href = json.redirect_to;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[700px] -translate-x-1/2 rounded-full bg-gold/[0.06] blur-[120px]"
      />
      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-6" />
          {step === "authorize" || step === "redirecting" ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                Connect {platform}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Authorize {platform} to access the CRM pipeline.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                Sign in to continue
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in to authorize {platform} to access the CRM pipeline.
              </p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur">
          {step === "loading" && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {step === "error" && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMsg}
            </p>
          )}

          {step === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              {errorMsg && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMsg}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@odigo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Signing in…" : "Sign in & Authorize"}
              </Button>
            </form>
          )}

          {(step === "authorize" || step === "redirecting") && (
            <div className="space-y-4">
              {userEmail && (
                <p className="text-center text-sm text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-medium text-foreground">
                    {userEmail}
                  </span>
                </p>
              )}
              {errorMsg && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMsg}
                </p>
              )}
              <Button
                className="w-full"
                onClick={handleAuthorize}
                disabled={busy}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {step === "redirecting"
                  ? "Redirecting…"
                  : busy
                    ? "Authorizing…"
                    : `Authorize ${platform}`}
              </Button>
            </div>
          )}
        </div>

        {step !== "error" && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Your credentials are sent securely and never stored by Claude.
          </p>
        )}
      </div>
    </main>
  );
}

export default function McpAuthorizePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <McpAuthorizeContent />
    </Suspense>
  );
}
