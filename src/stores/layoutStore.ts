import { create } from "zustand";

const STORAGE_KEY = "medlabcore-sidebar-collapsed";

/** Remembered choice, else expanded on wide screens (labels help on a lab PC) and collapsed below 1280px. */
function initialCollapsed() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === "true";
  } catch {
    // storage blocked: fall through to the width default
  }
  return typeof window === "undefined" || window.innerWidth < 1280;
}

interface LayoutState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarCollapsed: initialCollapsed(),
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // storage blocked: the choice lasts for this visit only
      }
      return { sidebarCollapsed: next };
    }),
}));
