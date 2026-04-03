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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useMemo } from "react";

const adminNavItems = [
  { label: "Labs", icon: Building2, path: "/admin/organizations" },
  { label: "Usuarios", icon: UserCog, path: "/admin/users" },
  { label: "Templates", icon: FlaskConical, path: "/admin/tests-templates" },
];

export function BottomNav() {
  const location = useLocation();
  const { isSuperAdmin } = useUserRole();
  const { permissions } = useCurrentOrgContext();

  const labNavItems = useMemo(() => {
    const items = [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", show: true },
      { label: "Pacientes", icon: Users, path: "/patients", show: true },
      { label: "Ordenes", icon: ShoppingCart, path: "/orders", show: true },
      { label: "Examenes", icon: FlaskConical, path: "/tests", show: permissions.canViewTests },
      { label: "Ventas", icon: Receipt, path: "/billing", show: permissions.canViewBilling },
      { label: "Config", icon: Settings, path: "/settings", show: permissions.canViewSettings },
    ];
    return items.filter((i) => i.show);
  }, [permissions]);

  const navItems = isSuperAdmin ? adminNavItems : labNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14">
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
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
