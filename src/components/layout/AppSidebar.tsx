import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layoutStore";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { isEntryActive, isGroup, isPathActive, useNavigation, type NavGroup, type NavLink } from "./useNavigation";

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
        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <item.icon className={cn("flex-shrink-0 transition-colors", nested ? "h-4 w-4" : "h-[18px] w-[18px]", isActive ? "text-sidebar-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
      {!collapsed && <span className="truncate animate-fade-in">{item.label}</span>}
      {isActive && !collapsed && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
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
          isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
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
            className="mr-1 rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
        {navEntries.map((entry) =>
          isGroup(entry)
            ? <SidebarGroup key={entry.label} group={entry} collapsed={sidebarCollapsed} />
            : <SidebarLink key={entry.path} item={entry} collapsed={sidebarCollapsed} />,
        )}
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
          aria-label={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
          className="flex h-9 w-full items-center justify-center rounded-lg border border-sidebar-border text-sidebar-muted transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
