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
import { useOnboarding } from "@/features/tour/useOnboarding";

// Loaded only when shown, so the presentation and tour library stay out of the normal bundle.
const DemoPresentation = isDemo ? lazy(() => import("@/features/tour/presentation/DemoPresentation")) : null;
const OnboardingGuide = lazy(() => import("@/features/tour/OnboardingGuide"));

export function AppLayout() {
  const { sidebarCollapsed } = useLayoutStore();
  const location = useLocation();
  const { user } = useAuth();
  const { orgId, role } = useCurrentOrgContext();
  const onboarding = useOnboarding();

  useEffect(() => {
    if (user) setSentryUser({ id: user.id, role, orgId });
  }, [user, role, orgId]);

  return (
    <div className="min-h-screen bg-background">
      {DemoPresentation && (
        <Suspense fallback={null}>
          <DemoPresentation />
        </Suspense>
      )}
      {onboarding.open && (
        <Suspense fallback={null}>
          <OnboardingGuide userId={onboarding.userId} onFinish={onboarding.finish} />
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
