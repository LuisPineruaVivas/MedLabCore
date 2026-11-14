import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layoutStore";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useBrand } from "@/contexts/BrandContext";
import { isEntryActive, isGroup, isPathActive, useNavigation, type NavGroup, type NavLink } from "./useNavigation";
import { labInitials } from "./AppHeader";

function SidebarLink({ item, collapsed, nested = false }: { item: NavLink; collapsed: boolean; nested?: boolean }) {
  const { pathname } = useLocation();
  const isActive = isPathActive(item.path, pathname);
  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-150",
        nested ? "py-2" : "py-2.5",
        isActive ? "neu-inset font-semibold text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <item.icon className={cn("flex-shrink-0 transition-colors", nested ? "h-4 w-4" : "h-[18px] w-[18px]", isActive ? "text-sidebar-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
      {!collapsed && <span className="truncate animate-fade-in">{item.label}</span>}
    </Link>
  );
}

/** A section such as "Administración": the name opens its home page, the arrow shows its pages. */
function SidebarGroup({ group, collapsed }: { group: NavGroup; collapsed: boolean }) {
  const { pathname } = useLocation();
  const isActive = isEntryActive(group, pathname);
  const [open, setOpen] = useState(isActive);
  // Entering any page of the section opens it.
  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <div>
      <div
        className={cn(
          "group flex items-center rounded-lg text-sm font-medium transition-all duration-150",
          isActive ? "text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent",
        )}
      >
        <Link to={group.path} onClick={() => setOpen(true)} title={collapsed ? group.label : undefined} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
          <group.icon className={cn("h-[18px] w-[18px] flex-shrink-0 transition-colors", isActive ? "text-sidebar-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
          {!collapsed && <span className="truncate animate-fade-in">{group.label}</span>}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? `Ocultar opciones de ${group.label}` : `Mostrar opciones de ${group.label}`}
            className="mr-1 grid h-8 w-8 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {/* Collapsed (icons only): the section's pages show while you are in it. */}
      {(collapsed ? isActive : open) && (
        <div className={cn("mt-1 space-y-0.5", collapsed ? "border-t border-sidebar-border pt-1" : "ml-4 border-l border-sidebar-border pl-2")}>
          {group.children.map((child) => <SidebarLink key={child.path} item={child} collapsed={collapsed} nested />)}
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const { sidebarCollapsed, toggleSidebar } = useLayoutStore();
  const { isSuperAdmin } = useUserRole();
  const { signOut, user } = useAuth();
  const { profile } = useCurrentOrgContext();
  const navEntries = useNavigation();
  const { brand } = useBrand();

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

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar shadow-[var(--neu-raised-sm)] transition-[width] duration-300",
        sidebarCollapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* The lab's own identity heads the rail; MedLabCore only for staff without a lab. */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-3.5">
        {!isSuperAdmin && brand.logoUrl ? (
          <img src={brand.logoUrl} alt={`Logo de ${brand.name}`} className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-0.5 neu-raised" />
        ) : !isSuperAdmin && brand.name ? (
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">{labInitials(brand.name)}</span>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white neu-raised">
            <img src="/logo.png" alt="MedLabCore" className="h-9 w-9 object-contain" />
          </div>
        )}
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-sidebar-foreground">
              {isSuperAdmin ? "MedLabCore Admin" : brand.name || "MedLabCore"}
            </p>
            <p className="mt-0.5 truncate text-xs leading-none text-sidebar-muted">
              {isSuperAdmin ? "Administración" : "MedLabCore"}
            </p>
          </div>
        )}
      </div>

      <nav aria-label="Menú principal" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navEntries.map((entry, index) => {
          const startsSection = entry.section && entry.section !== navEntries[index - 1]?.section;
          return (
            <div key={entry.path + entry.label}>
              {startsSection && (sidebarCollapsed
                ? index > 0 && <div className="mx-2 my-2 border-t border-sidebar-border" aria-hidden />
                : <p className={cn("px-3 pb-1 text-xs font-semibold text-sidebar-muted", index > 0 && "pt-4")}>{entry.section}</p>)}
              {isGroup(entry)
                ? <SidebarGroup group={entry} collapsed={sidebarCollapsed} />
                : <SidebarLink item={entry} collapsed={sidebarCollapsed} />}
            </div>
          );
        })}
      </nav>

      <div className="mb-4 space-y-1 px-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2 neu-inset">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar neu-raised">
            <User className="h-5 w-5 text-sidebar-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
            <p className="truncate text-xs font-medium text-sidebar-muted">
              {roleLabel}
            </p>
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1 animate-fade-in">
              <p className="truncate text-xs font-medium text-sidebar-accent-foreground">
                {displayName}
              </p>
              <p className="truncate text-[10px] text-sidebar-muted">{roleLabel}</p>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          title={sidebarCollapsed ? "Cerrar sesión" : undefined}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          {!sidebarCollapsed && <span>Cerrar sesión</span>}
        </button>

        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
          className="flex h-9 w-full items-center justify-center rounded-lg border border-input text-sidebar-muted shadow-[var(--neu-raised-sm)] transition-colors hover:text-sidebar-primary active:shadow-[var(--neu-inset)]"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
