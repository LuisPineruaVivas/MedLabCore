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
  HandCoins,
  Calculator,
  LogOut,
  ShoppingCart,
  User,
  ClipboardList,
  Landmark,
  FileText,
  Boxes,
  BarChart3,
} from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layoutStore";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useHasAffiliateUsers } from "@/features/billing/useAffiliateAccounts";
import { useErpModule } from "@/hooks/useErpModule";

const adminNavItems = [
  { label: "Laboratorios", icon: Building2, path: "/admin/organizations" },
  { label: "Usuarios", icon: UserCog, path: "/admin/users" },
  { label: "Examenes Templates", icon: FlaskConical, path: "/admin/tests-templates" },
  { label: "Cuentas Afiliadas", icon: HandCoins, path: "/affiliate-accounts" },
  { label: "Bitácora", icon: ClipboardList, path: "/audit-log" },
];

export function AppSidebar() {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useLayoutStore();
  const { isSuperAdmin } = useUserRole();
  const { signOut, user } = useAuth();
  const { profile, permissions } = useCurrentOrgContext();
  const { isErpEnabled, canManageFinances, canRegisterPayments, canManageCashRegister, canManageInventory, canViewFinancialReports } = useErpModule();
  const { data: hasAffiliateUsers = false } = useHasAffiliateUsers();

  const displayName = user?.email || "Usuario";
  const roleLabel = isSuperAdmin
    ? "Super Administrador"
    : profile?.role === "lab_admin"
      ? "Administrador"
      : profile?.role === "bioanalyst"
        ? "Bioanalista"
        : profile?.role === "secretary"
          ? "Secretaria"
          : profile?.role === "lab_affiliate"
            ? "Laboratorio Afiliado"
            : "Usuario";

  const labNavItems = useMemo(() => {
    const items = [
      { label: "Panel de control", icon: LayoutDashboard, path: "/dashboard", show: profile?.role !== "lab_affiliate" },
      { label: "Pacientes", icon: Users, path: "/patients", show: true },
      { label: "Ordenes", icon: ShoppingCart, path: "/orders", show: true },
      { label: "Examenes", icon: FlaskConical, path: "/tests", show: permissions.canViewTests },
      { label: "Ventas", icon: Receipt, path: "/billing", show: permissions.canViewBilling },
      { label: "Facturas", icon: FileText, path: "/erp/invoices", show: isErpEnabled && (canManageFinances || canRegisterPayments) },
      { label: "Métodos de cobro", icon: Landmark, path: "/erp/bank-accounts", show: isErpEnabled && canManageFinances },
      { label: "Cuentas por cobrar", icon: HandCoins, path: "/erp/accounts-receivable", show: isErpEnabled && canManageFinances },
      { label: "Caja", icon: Calculator, path: "/erp/cash-register", show: isErpEnabled && canManageCashRegister },
      { label: "Inventario", icon: Boxes, path: "/erp/inventory", show: isErpEnabled && canManageInventory },
      { label: "Reportes", icon: BarChart3, path: "/erp/reports", show: isErpEnabled && canViewFinancialReports },
      { label: "Cuentas Afiliadas", icon: HandCoins, path: "/affiliate-accounts", show: profile?.role === "lab_admin" && hasAffiliateUsers },
      /*{ label: "Bitácora", icon: ClipboardList, path: "/audit-log", show: profile?.role === "lab_admin" },*/
      { label: "Configuracion", icon: Settings, path: "/settings", show: permissions.canViewSettings },
    ];

    return items.filter((item) => item.show);
  }, [canManageCashRegister, canManageFinances, canManageInventory, canRegisterPayments, canViewFinancialReports, hasAffiliateUsers, isErpEnabled, permissions, profile?.role]);

  const navItems = isSuperAdmin ? adminNavItems.filter((item) => item.path !== "/affiliate-accounts" || hasAffiliateUsers) : labNavItems;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border sidebar-gradient transition-all duration-300",
        sidebarCollapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      <div className="flex h-32 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white">
          <img src="/logo.png" alt="Medlabcore Logo" className="h-16 w-16 object-contain" />
        </div>
        {!sidebarCollapsed && (
          <div className="animate-fade-in">
            <span className="tracking-tight text-sm font-bold text-sidebar-accent-foreground">
              {isSuperAdmin ? "Medlabcore Admin" : "Medlabcore"}
            </span>
            <p className="mt-0.5 text-[10px] leading-none text-sidebar-muted">
              {isSuperAdmin ? "Administracion" : "Gestion de Laboratorio"}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] flex-shrink-0 transition-colors",
                  isActive ? "text-sidebar-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground"
                )}
              />
              {!sidebarCollapsed && <span className="truncate animate-fade-in">{item.label}</span>}
              {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="mb-4 space-y-1 px-3">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/60 px-3 py-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent">
            <User className="h-5 w-5 text-sidebar-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
            <p className="truncate text-[10px] font-semibold uppercase text-sidebar-foreground/60">
              {roleLabel}
            </p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          {!sidebarCollapsed && <span className="animate-fade-in">Cerrar Sesion</span>}
        </button>

        <button
          onClick={toggleSidebar}
          className="flex h-9 w-full items-center justify-center rounded-lg border border-sidebar-border text-sidebar-muted transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
