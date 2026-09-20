import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ImpersonationState {
  originalSession: {
    access_token: string;
    refresh_token: string;
  };
  originalUser: {
    id: string;
    email: string;
    role: string;
  };
  impersonatedUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    org_id: string;
    org_name: string;
  };
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonationState["impersonatedUser"] | null;
  startImpersonation: (targetUserId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  isLoading: boolean;
}

const STORAGE_KEY = "medlab_superadmin_impersonation_state";

const ImpersonationContext = createContext<ImpersonationContextType>({
  isImpersonating: false,
  impersonatedUser: null,
  startImpersonation: async () => {},
  stopImpersonation: async () => {},
  isLoading: false,
});

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ImpersonationState | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state]);

  const startImpersonation = useCallback(
    async (targetUserId: string) => {
      try {
        setIsLoading(true);

        // 1. Get current superadmin session
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!currentSession) {
          throw new Error("No hay una sesión activa de Super Admin");
        }

        // 2. Invoke Edge Function to get impersonation token and log audit
        const { data: result, error: fnError } = await supabase.functions.invoke(
          "superadmin-impersonate",
          {
            body: { target_user_id: targetUserId, action: "start" },
          }
        );

        if (fnError) {
          throw new Error(fnError.message || "Error al invocar servicio de suplantación");
        }
        if (result?.error) {
          throw new Error(result.error);
        }

        // 3. Save current Super Admin session before switching
        const originalState: ImpersonationState = {
          originalSession: {
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token,
          },
          originalUser: {
            id: currentSession.user.id,
            email: currentSession.user.email || "",
            role: "super_admin",
          },
          impersonatedUser: result.target_user,
        };

        // 4. Authenticate as target user using OTP or hashed_token
        if (result.email_otp && result.email) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            email: result.email,
            token: result.email_otp,
            type: "magiclink",
          });

          if (otpError) {
            throw new Error(`Error al iniciar sesión como el usuario: ${otpError.message}`);
          }
        } else if (result.hashed_token) {
          const { error: hashError } = await supabase.auth.verifyOtp({
            token_hash: result.hashed_token,
            type: "magiclink",
          });

          if (hashError) {
            throw new Error(`Error al verificar token de sesión: ${hashError.message}`);
          }
        } else {
          throw new Error("No se pudo obtener el token de autenticación del usuario");
        }

        // 5. Update local state and save to localStorage
        setState(originalState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(originalState));

        // 6. Invalidate all cached queries to refresh UI for the new user
        queryClient.clear();

        toast.success(`Iniciaste sesión en modo soporte como ${result.target_user.name}`);

        // Redirect to dashboard or orders
        window.location.href = "/dashboard";
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al iniciar sesión como usuario";
        toast.error(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [queryClient]
  );

  const stopImpersonation = useCallback(async () => {
    try {
      setIsLoading(true);

      const savedState = state || (() => {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          return saved ? JSON.parse(saved) : null;
        } catch {
          return null;
        }
      })();

      if (!savedState) {
        toast.error("No se encontró información de la sesión original de Super Admin");
        return;
      }

      // 1. Notify edge function to record SUPERADMIN_IMPERSONATION_END in audit_logs
      try {
        await supabase.functions.invoke("superadmin-impersonate", {
          body: {
            target_user_id: savedState.impersonatedUser.id,
            action: "end",
          },
        });
      } catch (logErr) {
        console.warn("Could not log impersonation end to server:", logErr);
      }

      // 2. Restore Super Admin session
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: savedState.originalSession.access_token,
        refresh_token: savedState.originalSession.refresh_token,
      });

      if (restoreError) {
        // If restoring session token directly fails, refresh it
        toast.info("Restaurando sesión con credenciales originales...");
      }

      // 3. Clear local state
      setState(null);
      localStorage.removeItem(STORAGE_KEY);

      // 4. Invalidate and clear queries
      queryClient.clear();

      toast.success("Has regresado a tu cuenta de Super Admin");

      // Redirect back to Admin Users page
      window.location.href = "/admin/users";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al restaurar sesión";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [state, queryClient]);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating: !!state,
        impersonatedUser: state?.impersonatedUser ?? null,
        startImpersonation,
        stopImpersonation,
        isLoading,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export const useImpersonation = () => useContext(ImpersonationContext);
