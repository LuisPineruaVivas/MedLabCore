import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  FlaskConical,
  Settings,
  Building2,
  UserCog,
  Receipt,
  HandCoins,
} from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useHasAffiliateUsers } from "@/features/billing/useAffiliateAccounts";

const adminNavItems = [
  { label: "Labs", icon: Building2, path: "/admin/organizations" },
  { label: "Usuarios", icon: UserCog, path: "/admin/users" },
  { label: "Templates", icon: FlaskConical, path: "/admin/tests-templates" },
  { label: "Afiliados", icon: HandCoins, path: "/affiliate-accounts" },
];

export function BottomNav() {
  const location = useLocation();
  const { isSuperAdmin } = useUserRole();
  const { permissions, profile } = useCurrentOrgContext();
  const { data: hasAffiliateUsers = false } = useHasAffiliateUsers();

  const labNavItems = useMemo(() => {
    const items = [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", show: profile?.role !== "lab_affiliate" },
      { label: "Pacientes", icon: Users, path: "/patients", show: true },
      { label: "Ordenes", icon: ShoppingCart, path: "/orders", show: true },
      { label: "Examenes", icon: FlaskConical, path: "/tests", show: permissions.canViewTests },
      { label: "Ventas", icon: Receipt, path: "/billing", show: permissions.canViewBilling },
      { label: "Afiliados", icon: HandCoins, path: "/affiliate-accounts", show: profile?.role === "lab_admin" && hasAffiliateUsers },
      { label: "Config", icon: Settings, path: "/settings", show: permissions.canViewSettings },
    ];

    return items.filter((item) => item.show);
  }, [hasAffiliateUsers, permissions, profile?.role]);

  const navItems = isSuperAdmin ? adminNavItems.filter((item) => item.path !== "/affiliate-accounts" || hasAffiliateUsers) : labNavItems;

  return (
    <nav className="safe-area-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="flex h-14 items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            item.path === "/dashboard"
              ? location.pathname === "/dashboard" || location.pathname === "/"
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex h-full flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
