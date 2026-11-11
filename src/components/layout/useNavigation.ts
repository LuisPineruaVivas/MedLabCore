import { useMemo } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FileText,
  FlaskConical,
  HandCoins,
  Landmark,
  LayoutDashboard,
  PieChart,
  Receipt,
  ReceiptText,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useHasAffiliateUsers } from "@/features/billing/useAffiliateAccounts";
import { useErpModule } from "@/hooks/useErpModule";

export interface NavLink {
  label: string;
  /** Short label for the mobile bar. */
  short?: string;
  icon: LucideIcon;
  path: string;
}
export interface NavGroup extends NavLink {
  /** `path` is the group's home: where clicking the group name goes. */
  children: NavLink[];
}
export type NavEntry = NavLink | NavGroup;

export const isGroup = (entry: NavEntry): entry is NavGroup => "children" in entry;

/** "/erp" is the admin home, a prefix of every ERP page: it only matches exactly. */
export function isPathActive(path: string, pathname: string) {
  if (path === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  if (path === "/erp") return pathname === "/erp";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export const isEntryActive = (entry: NavEntry, pathname: string) =>
  isGroup(entry) ? entry.children.some((child) => isPathActive(child.path, pathname)) || isPathActive(entry.path, pathname) : isPathActive(entry.path, pathname);

const superAdminEntries = (hasAffiliateUsers: boolean): NavEntry[] =>
  [
    { label: "Laboratorios", short: "Labs", icon: Building2, path: "/admin/organizations" },
    { label: "Usuarios", icon: UserCog, path: "/admin/users" },
    { label: "Examenes Templates", short: "Templates", icon: FlaskConical, path: "/admin/tests-templates" },
    { label: "Cuentas Afiliadas", short: "Afiliados", icon: HandCoins, path: "/affiliate-accounts" },
    { label: "Bitácora", icon: ClipboardList, path: "/audit-log" },
  ].filter((item) => item.path !== "/affiliate-accounts" || hasAffiliateUsers);

/**
 * The app menu, shared by the desktop sidebar and the mobile bar and drawer. ERP finance pages
 * are grouped under "Administración"; each entry only appears for roles allowed in App.tsx.
 */
export function useNavigation(): NavEntry[] {
  const { isSuperAdmin } = useUserRole();
  const { profile, permissions } = useCurrentOrgContext();
  const { isErpEnabled, canManageFinances, canRegisterPayments, canManageInventory, canViewFinancialReports } = useErpModule();
  const { data: hasAffiliateUsers = false } = useHasAffiliateUsers();

  return useMemo(() => {
    if (isSuperAdmin) return superAdminEntries(hasAffiliateUsers);

    const finance = isErpEnabled && (canManageFinances || canRegisterPayments);
    const adminChildren = [
      { label: "Resumen", icon: PieChart, path: "/erp", show: isErpEnabled && canViewFinancialReports },
      { label: "Por cobrar", icon: HandCoins, path: "/erp/receivables", show: finance },
      { label: "Por pagar", icon: ReceiptText, path: "/erp/payables", show: finance },
      { label: "Movimientos", icon: ArrowLeftRight, path: "/erp/movements", show: finance },
      { label: "Facturas", icon: FileText, path: "/erp/invoices", show: finance },
      { label: "Cuentas", icon: Landmark, path: "/erp/accounts", show: isErpEnabled && canManageFinances },
      { label: "Reportes", icon: BarChart3, path: "/erp/reports", show: isErpEnabled && canViewFinancialReports },
    ].filter((item) => item.show).map(({ show: _show, ...item }) => item);

    const entries: (NavEntry & { show: boolean })[] = [
      { label: "Panel de control", short: "Panel", icon: LayoutDashboard, path: "/dashboard", show: profile?.role !== "lab_affiliate" },
      { label: "Pacientes", icon: Users, path: "/patients", show: true },
      { label: "Ordenes", icon: ShoppingCart, path: "/orders", show: true },
      { label: "Examenes", icon: FlaskConical, path: "/tests", show: permissions.canViewTests },
      { label: "Ventas", icon: Receipt, path: "/billing", show: permissions.canViewBilling },
      { label: "Administración", short: "Admin.", icon: Wallet, path: adminChildren[0]?.path ?? "/erp", children: adminChildren, show: adminChildren.length > 0 },
      { label: "Inventario", icon: Boxes, path: "/erp/inventory", show: isErpEnabled && canManageInventory },
      { label: "Cuentas Afiliadas", short: "Afiliados", icon: HandCoins, path: "/affiliate-accounts", show: profile?.role === "lab_admin" && hasAffiliateUsers },
      { label: "Configuracion", short: "Config", icon: Settings, path: "/settings", show: permissions.canViewSettings },
    ];
    return entries.filter((entry) => entry.show).map(({ show: _show, ...entry }) => entry as NavEntry);
  }, [canManageFinances, canManageInventory, canRegisterPayments, canViewFinancialReports, hasAffiliateUsers, isErpEnabled, isSuperAdmin, permissions, profile?.role]);
}
