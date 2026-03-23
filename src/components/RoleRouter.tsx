import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

export function RoleRouter() {
  const { role, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (role === "super_admin") {
    return <Navigate to="/admin/organizations" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
