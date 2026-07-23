"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { LayoutDashboard, KanbanSquare, Building2, Calendar, CheckCircle2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/components/shared/role-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, exact: false },
  { href: "/companies", label: "Clients", icon: Building2, exact: false },
];

type CalendarStatus = {
  google: boolean
  googleEmail: string | null
  outlook: boolean
  outlookEmail: string | null
}

function CalendarConnectButton({
  provider,
  label,
  connected,
  accountEmail,
  onConnected,
  onDisconnected,
}: {
  provider: "google" | "outlook"
  label: string
  connected: boolean
  accountEmail: string | null
  onConnected: () => void
  onDisconnected: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleConnect() {
    setLoading(true)
    try {
      const res = await fetch("/api/calendar/connect-token", { method: "POST" })
      const { token, mcpBase } = await res.json()
      const url = `${mcpBase}/connect/${provider}?token=${token}`
      window.open(url, "_blank", "width=520,height=640,noopener")
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await fetch("/api/calendar/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      })
      onDisconnected()
    } catch {
      // silently fail — user can retry
    } finally {
      setDisconnecting(false)
      setConfirmOpen(false)
    }
  }

  if (connected) {
    return (
      <>
        <div className="group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 self-start text-gold" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-foreground">{label}</div>
            {accountEmail && (
              <div className="truncate text-[11px] text-muted-foreground">{accountEmail}</div>
            )}
          </div>
          <span className="ml-auto shrink-0 text-[11px] text-gold/80 group-hover:hidden">Connected</span>
          <button
            onClick={() => setConfirmOpen(true)}
            title={`Disconnect ${label}`}
            className="ml-auto hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors group-hover:flex"
          >
            <X className="h-3 w-3" />
            Disconnect
          </button>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Disconnect {label}?</DialogTitle>
              <DialogDescription>
                This will remove your {label} connection{accountEmail ? ` (${accountEmail})` : ""}. Claude will no longer be able to send calendar invites until you reconnect.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={disconnecting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-all duration-150 hover:bg-secondary/50 hover:text-foreground disabled:opacity-60"
    >
      {loading
        ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        : <Calendar className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      }
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground">
        Connect
      </span>
    </button>
  )
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { isAdmin } = useRole()
  const [status, setStatus] = useState<CalendarStatus | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/status")
      if (res.ok) setStatus(await res.json())
    } catch { /* no-op */ }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    refreshStatus()

    // Refresh when the user completes OAuth in the popup
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "calendar-connected") refreshStatus()
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [isAdmin, refreshStatus])

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 transition-colors",
                active
                  ? "text-gold"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            {item.label}
          </Link>
        );
      })}

      {isAdmin && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="px-3 mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
            AI Calendar
          </p>
          <CalendarConnectButton
            provider="google"
            label="Google"
            connected={status?.google ?? false}
            accountEmail={status?.googleEmail ?? null}
            onConnected={refreshStatus}
            onDisconnected={refreshStatus}
          />
          <CalendarConnectButton
            provider="outlook"
            label="Outlook"
            connected={status?.outlook ?? false}
            accountEmail={status?.outlookEmail ?? null}
            onConnected={refreshStatus}
            onDisconnected={refreshStatus}
          />
        </div>
      )}
    </nav>
  );
}
