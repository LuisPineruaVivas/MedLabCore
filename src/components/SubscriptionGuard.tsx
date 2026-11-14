import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { SubscriptionLockScreen } from "@/features/subscription/SubscriptionLockScreen";
import { Outlet } from "react-router-dom";

export function SubscriptionGuard({ children }: { children?: React.ReactNode }) {
  const { subscriptionStatus, role, isLoading } = useCurrentOrgContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Super admin is exempt from subscription blocks
  if (role === "super_admin") {
    return children ? <>{children}</> : <Outlet />;
  }

  // If subscription is expired and grace period ended, block system
  if (subscriptionStatus.isBlocked) {
    return <SubscriptionLockScreen />;
  }

  return children ? <>{children}</> : <Outlet />;
}
