import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { useLayoutStore } from "@/stores/layoutStore";
import { cn } from "@/lib/utils";
import { Footer } from "./Footer";
import { PWAInstallBanner } from "../InstallPWA";

export function AppLayout() {
  const { sidebarCollapsed } = useLayoutStore();

  return (
    <div className="min-h-screen bg-background">
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
          <Outlet />
        </main>
        <footer className="">
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
