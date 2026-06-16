"use client";

import { createContext, useContext } from "react";
import type { Profile, UserRole } from "@/lib/types";

interface RoleContextValue {
  profile: Profile;
  role: UserRole;
  isAdmin: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <RoleContext.Provider
      value={{ profile, role: profile.role, isAdmin: profile.role === "admin" }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
