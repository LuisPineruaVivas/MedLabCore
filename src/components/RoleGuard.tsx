import { Navigate, Outlet } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

interface RoleGuardProps {
  /** Permission key from usePermissions that must be true */
  permission: keyof ReturnType<typeof usePermissions>;
}

export function RoleGuard({ permission }: RoleGuardProps) {
  const permissions = usePermissions();

  if (permissions.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!permissions[permission]) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
