import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Drawer } from "vaul";
import { LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { isEntryActive, isGroup, isPathActive, useNavigation, type NavEntry, type NavLink } from "./useNavigation";

/** Entries pinned to the bar (at most 4); everything is also in the "Menú" drawer. */
const PINNED_PATHS = ["/dashboard", "/patients", "/orders"];
const MAX_PINNED = 4;

function pinnedEntries(entries: NavEntry[]): NavEntry[] {
  const pinned = entries.filter((entry) => PINNED_PATHS.includes(entry.path));
  // Fourth slot: the Administración section when the user has it, else the next page available.
  const extra = entries.find((entry) => isGroup(entry)) ?? entries.find((entry) => !pinned.includes(entry));
  return [...pinned, ...(extra && !pinned.includes(extra) ? [extra] : [])].slice(0, MAX_PINNED);
}

function DrawerLink({ item, onNavigate, nested = false }: { item: NavLink; onNavigate: () => void; nested?: boolean }) {
  const { pathname } = useLocation();
  const isActive = isPathActive(item.path, pathname);
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
        nested && "py-2.5",
        isActive ? "neu-inset font-semibold text-primary" : "text-foreground hover:bg-secondary",
      )}
    >
      <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
      {item.label}
    </Link>
  );
}

export function BottomNav() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const entries = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const pinned = pinnedEntries(entries);
  const close = () => setMenuOpen(false);
  // Close the drawer when the route changes (e.g. browser back).
  useEffect(() => setMenuOpen(false), [pathname]);

  const links = entries.filter((entry) => !isGroup(entry)) as NavLink[];
  const groups = entries.filter(isGroup);
  const menuActive = !pinned.some((entry) => isEntryActive(entry, pathname));

  return (
    <Drawer.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <nav aria-label="Navegación principal" className="safe-area-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background shadow-[0_-4px_12px_hsl(var(--neu-lo)/0.35)]">
        <div className="flex h-14 items-center justify-around">
          {pinned.map((entry) => {
            const isActive = isEntryActive(entry, pathname);
            return (
              <Link
                key={entry.path}
                to={entry.path}
                aria-current={isActive ? "page" : undefined}
                className={cn("flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors", isActive ? "font-semibold text-primary" : "text-muted-foreground")}
              >
                <entry.icon className="h-5 w-5" />
                <span className="text-[11px] leading-none">{entry.short ?? entry.label}</span>
              </Link>
            );
          })}
          <Drawer.Trigger asChild>
            <button
              type="button"
              className={cn("flex h-full flex-1 flex-col items-center justify-center gap-0.5 transition-colors", menuActive ? "text-primary" : "text-muted-foreground")}
            >
              <Menu className="h-5 w-5" />
              <span className="text-[11px] leading-none">Menú</span>
            </button>
          </Drawer.Trigger>
        </div>
      </nav>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-3xl border-t bg-background shadow-[var(--shadow-elevated)] outline-none">
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted" />
          <div className="flex items-center justify-between px-5 pt-3">
            <Drawer.Title className="text-base font-semibold">Menú</Drawer.Title>
            <ThemeToggle />
          </div>
          <Drawer.Description className="sr-only">Todas las secciones de la aplicación</Drawer.Description>
          <div className="space-y-4 overflow-y-auto px-3 pb-6 pt-2">
            <div className="space-y-0.5">
              {links.map((item) => <DrawerLink key={item.path} item={item} onNavigate={close} />)}
            </div>
            {groups.map((group) => (
              <div key={group.label} className="space-y-0.5">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                {group.children.map((child) => <DrawerLink key={child.path} item={child} onNavigate={close} nested />)}
              </div>
            ))}
            <button
              type="button"
              onClick={() => { close(); void signOut(); }}
              className="flex w-full items-center gap-3 rounded-lg border-t px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" />Cerrar sesión
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
