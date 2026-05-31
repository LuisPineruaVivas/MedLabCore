import { Navigate, Outlet } from "react-router-dom";
import type { UserRole } from "@/hooks/useUserRole";
import { useUserRole } from "@/hooks/useUserRole";

interface AllowedRolesGuardProps {
  roles: UserRole[];
}

export function AllowedRolesGuard({ roles }: AllowedRolesGuardProps) {
  const { role, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!role || !roles.includes(role)) {
    return <Navigate to={role === "lab_affiliate" ? "/orders" : "/dashboard"} replace />;
  }

  return <Outlet />;
}
