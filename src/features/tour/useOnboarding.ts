import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { queryKeys } from "@/lib/queryKeys";
import { isDemo } from "@/lib/demo/isDemo";

/**
 * Whether to show the onboarding guide: lab admins whose profile has not finished it.
 * Once shown it stays for the session, so finishing the last task doesn't yank the panel away.
 */
export function useOnboarding() {
  const queryClient = useQueryClient();
  const { user, role, profile } = useCurrentOrgContext();
  const { isImpersonating } = useImpersonation();
  const pending = !isDemo && !isImpersonating && role === "lab_admin" && !!profile && !profile.onboarding_completed_at;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pending) setOpen(true);
  }, [pending]);

  const complete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("complete_onboarding");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile(user?.id) }),
    onError: () => toast.error("No se pudo guardar que terminaste la guía. Volverá a aparecer la próxima vez."),
  });

  return {
    open: open && !!user,
    userId: user?.id ?? "",
    finish: () => {
      setOpen(false);
      complete.mutate();
    },
  };
}
