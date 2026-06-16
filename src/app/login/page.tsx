import { LoginForm } from "./login-form";
import { Logo } from "@/components/shared/logo";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Ambient gold glow — restrained, not decorative for its own sake */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[700px] -translate-x-1/2 rounded-full bg-gold/[0.06] blur-[120px]"
      />
      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-6" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to the Odigo project workspace.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur">
          <LoginForm />
        </div>

        <div className="mt-6 rounded-lg border border-border/60 bg-secondary/30 p-3.5 text-xs text-muted-foreground">
          <p className="mb-1.5 font-medium text-foreground/80">
            Demo accounts
          </p>
          <p className="font-mono">admin@odigo-test.com · full access</p>
          <p className="font-mono">viewer@odigo-test.com · read only</p>
          <p className="mt-1.5 font-mono opacity-70">
            password: OdigoTest2026!
          </p>
        </div>
      </div>
    </main>
  );
}
