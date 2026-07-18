import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth, type Role } from "../lib/auth.js";

export function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/pos" replace />;
  return <>{children}</>;
}
