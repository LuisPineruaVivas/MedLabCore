import { Suspense, lazy, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { setSentryUser } from "@/lib/sentry";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { useLayoutStore } from "@/stores/layoutStore";
import { cn } from "@/lib/utils";
import { Footer } from "./Footer";
import { PWAInstallBanner } from "../InstallPWA";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { SubscriptionBanner } from "@/features/subscription/SubscriptionBanner";
import { isDemo } from "@/lib/demo/isDemo";

// Loaded only in demo mode so the tour library stays out of the normal bundle.
const DemoGuide = isDemo ? lazy(() => import("@/features/tour/DemoGuide")) : null;

export function AppLayout() {
  const { sidebarCollapsed } = useLayoutStore();
  const location = useLocation();
  const { user } = useAuth();
  const { orgId, role } = useCurrentOrgContext();

  useEffect(() => {
    if (user) setSentryUser({ id: user.id, role, orgId });
  }, [user, role, orgId]);

  return (
    <div className="min-h-screen bg-background">
      {DemoGuide && (
        <Suspense fallback={null}>
          <DemoGuide />
        </Suspense>
      )}
      <ImpersonationBanner />
      <SubscriptionBanner />
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <div
        className={cn(
          "transition-all duration-300",
          "md:ml-[240px]",
          sidebarCollapsed && "md:ml-[68px]",
          "grid grid-rows-[auto_1fr_auto] min-h-screen"
        )}
      >
        <AppHeader />
        <main className="p-3 sm:p-6 pb-20 md:pb-6">
          {/* Keyed by path so moving to another page clears a crashed one; menu and header keep working. */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        <footer className="mb-14 md:mb-0">
          <Footer />
        </footer>
      </div>
      <PWAInstallBanner />
      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
