import { Navigate, Outlet } from "react-router-dom";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";

export function ErpGuard() {
  const { isLoading } = useCurrentOrgContext();
  const { isErpEnabled } = useErpModule();

  // Wait for the organization: before it loads has_erp_module reads as false, and
  // redirecting then would bounce every reload or deep link of an /erp page.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return isErpEnabled ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
