import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo showWord={false} className="scale-125" />
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-gold">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          We couldn&apos;t find that
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The page or record you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Button asChild variant="secondary">
        <Link href="/">Back to dashboard</Link>
      </Button>
    </main>
  );
}
