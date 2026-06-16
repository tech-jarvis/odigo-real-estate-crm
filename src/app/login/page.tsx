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
      </div>
    </main>
  );
}
