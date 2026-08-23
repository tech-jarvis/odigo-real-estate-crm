"use client";

import { createContext, useContext } from "react";
import type { CurrentUser, OrgMembershipWithOrg, Profile, UserRole } from "@/lib/types";

interface RoleContextValue {
  profile: Profile;
  memberships: OrgMembershipWithOrg[];
  currentOrgId: string | null;
  role: UserRole | null;
  isAdmin: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({
  current,
  children,
}: {
  current: CurrentUser;
  children: React.ReactNode;
}) {
  return (
    <RoleContext.Provider
      value={{
        profile: current.profile,
        memberships: current.memberships,
        currentOrgId: current.currentOrgId,
        role: current.currentRole,
        isAdmin: current.currentRole === "admin",
      }}
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
