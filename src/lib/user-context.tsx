"use client";

import { createContext, useContext } from "react";

export interface FkUser {
  id: string;
  name: string;
  role: "admin" | "member";
}

const UserContext = createContext<FkUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: FkUser | null;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): FkUser | null {
  return useContext(UserContext);
}
