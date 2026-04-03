import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FlaskConical,
  Receipt,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  UserCog,
  LogOut,
  ShoppingCart,
  Bell,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layoutStore";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useMemo } from "react";

const adminNavItems = [
  { label: "Laboratorios", icon: Building2, path: "/admin/organizations" },
  { label: "Usuarios", icon: UserCog, path: "/admin/users" },
  { label: "Examenes Templates", icon: FlaskConical, path: "/admin/tests-templates" },
];

export function AppSidebar() {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useLayoutStore();
  const { isSuperAdmin } = useUserRole();
  const { signOut, user } = useAuth();
  const { profile, permissions } = useCurrentOrgContext();

  const displayName = user?.email || "Usuario";
  const roleLabel = isSuperAdmin
    ? "Super Administrador"
    : profile?.role === "lab_admin"
    ? "Administrador"
    : profile?.role === "bioanalyst"
    ? "Bioanalista"
    : profile?.role === "secretary"
    ? "Secretaria"
    : "Usuario";

  const labNavItems = useMemo(() => {
    const items = [
      { label: "Panel de control", icon: LayoutDashboard, path: "/", show: true },
      { label: "Pacientes", icon: Users, path: "/patients", show: true },
      { label: "Ordenes", icon: ShoppingCart, path: "/orders", show: true },
      { label: "Examenes", icon: FlaskConical, path: "/tests", show: permissions.canViewTests },
      { label: "Ventas", icon: Receipt, path: "/billing", show: permissions.canViewBilling },
      { label: "Configuración", icon: Settings, path: "/settings", show: permissions.canViewSettings },
    ];
    return items.filter((i) => i.show);
  }, [permissions]);

  const navItems = isSuperAdmin ? adminNavItems : labNavItems;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen sidebar-gradient border-r border-sidebar-border transition-all duration-300 flex flex-col",
        sidebarCollapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-32 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-white">
          <img
            src="/logo.png"
            alt="Medlabcore Logo"
            className="w-16 h-16 object-contain"
          />
        </div>
        {!sidebarCollapsed && (
          <div className="animate-fade-in">
            <span className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">
              {isSuperAdmin ? "Medlabcore Admin" : "Medlabcore"}
            </span>
            <p className="text-[10px] text-sidebar-muted leading-none mt-0.5">
              {isSuperAdmin ? "Administración" : "Gestión de Laboratorio"}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "w-[18px] h-[18px] flex-shrink-0 transition-colors",
                  isActive ? "text-sidebar-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground"
                )}
              />
              {!sidebarCollapsed && (
                <span className="animate-fade-in truncate">{item.label}</span>
              )}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 mb-4 space-y-1">
        <div className="flex gap-3 items-center px-3 py-2 rounded-lg bg-sidebar-accent/60">
          <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
            <User className="h-5 w-5 text-sidebar-foreground" />
          </div>
          <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {displayName}
              </p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate uppercase font-semibold">
                {roleLabel}
              </p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!sidebarCollapsed && <span className="animate-fade-in">Cerrar Sesion</span>}
        </button>

        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full h-9 rounded-lg border border-sidebar-border text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
