"use client";

import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/components/shared/role-context";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

export function UserMenu() {
  const { profile, isAdmin } = useRole();

  const handleSignOut = async () => {
    await fetch("/auth/signout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-left transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-gold/40">
        <Avatar name={profile.full_name} className="h-7 w-7 text-[11px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">
            {profile.full_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {profile.email}
          </p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Account</span>
          <Badge variant={isAdmin ? "gold" : "outline"}>
            {isAdmin ? "Admin" : "Viewer"}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeSwitcher />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
