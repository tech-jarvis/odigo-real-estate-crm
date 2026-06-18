"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-card/40 p-4 lg:flex">
        <div className="px-2 py-3">
          <Logo />
        </div>
        <div className="mt-4 flex-1">
          <SidebarNav />
        </div>
        <UserMenu />
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md border border-border bg-secondary/40 p-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* ---------- Mobile drawer ---------- */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/60 transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 flex h-full w-[260px] flex-col border-r border-border bg-card p-4 transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="px-2 py-3">
            <Logo />
          </div>
          <div className="mt-4 flex-1">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
          <UserMenu />
        </aside>
      </div>

      {/* ---------- Main content ---------- */}
      <main className="min-w-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
