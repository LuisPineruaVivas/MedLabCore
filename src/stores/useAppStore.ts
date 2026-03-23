import { create } from 'zustand';

/**
 * App-level UI state only.
 * User profile and role data are managed by useAuth + useUserRole + React Query.
 * Do NOT duplicate auth/profile state here — it creates two sources of truth.
 */
interface AppStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppStore>()((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));