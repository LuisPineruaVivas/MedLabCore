// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IMPERSONATION_STORAGE_KEY } from "@/lib/impersonationStorage";

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  listener: null as null | ((event: string, session: unknown) => void),
  signOut: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        auth.listener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getSession: async () => ({ data: { session: null } }),
      signOut: auth.signOut,
    },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const savedState = {
  originalSession: { access_token: "super-access", refresh_token: "super-refresh" },
  originalUser: { id: "super-1", email: "super@example.test", role: "super_admin" },
  impersonatedUser: {
    id: "lab-user-1",
    name: "Lab User",
    email: "lab@example.test",
    role: "secretary",
    org_id: "org-1",
    org_name: "Lab",
  },
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(node: ReactNode) {
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(node));
  return root;
}

describe("impersonation state lifetime", () => {
  beforeEach(() => {
    localStorage.clear();
    auth.user = null;
    auth.loading = false;
  });

  async function renderImpersonation() {
    vi.doMock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.user, loading: auth.loading }) }));
    vi.resetModules();
    const { ImpersonationProvider, useImpersonation } = await import("@/contexts/ImpersonationContext");
    const queryClient = new QueryClient();
    const result = { current: null as unknown as ReturnType<typeof useImpersonation> };
    function Probe() {
      result.current = useImpersonation();
      return null;
    }
    await render(
      <QueryClientProvider client={queryClient}>
        <ImpersonationProvider><Probe /></ImpersonationProvider>
      </QueryClientProvider>
    );
    return { result };
  }

  it("rehydrates the saved state for the impersonated user", async () => {
    localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(savedState));
    auth.user = { id: "lab-user-1" };
    const { result } = await renderImpersonation();
    expect(result.current.isImpersonating).toBe(true);
    expect(localStorage.getItem(IMPERSONATION_STORAGE_KEY)).not.toBeNull();
  });

  it("drops the saved super admin tokens when another user is signed in", async () => {
    localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(savedState));
    auth.user = { id: "someone-else" };
    const { result } = await renderImpersonation();
    expect(result.current.isImpersonating).toBe(false);
    expect(localStorage.getItem(IMPERSONATION_STORAGE_KEY)).toBeNull();
  });

  it("keeps the saved state while auth is still loading", async () => {
    localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(savedState));
    auth.loading = true;
    await renderImpersonation();
    expect(localStorage.getItem(IMPERSONATION_STORAGE_KEY)).not.toBeNull();
  });

  it("clears the saved state on signOut and on SIGNED_OUT", async () => {
    vi.doUnmock("@/hooks/useAuth");
    vi.resetModules();
    const { AuthProvider, useAuth } = await import("@/hooks/useAuth");
    let signOut: () => Promise<void> = async () => {};
    function Probe() {
      signOut = useAuth().signOut;
      return null;
    }
    await render(<AuthProvider><Probe /></AuthProvider>);

    localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(savedState));
    await act(() => signOut());
    expect(auth.signOut).toHaveBeenCalled();
    expect(localStorage.getItem(IMPERSONATION_STORAGE_KEY)).toBeNull();

    localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(savedState));
    await act(async () => auth.listener?.("SIGNED_OUT", null));
    expect(localStorage.getItem(IMPERSONATION_STORAGE_KEY)).toBeNull();
  });
});
