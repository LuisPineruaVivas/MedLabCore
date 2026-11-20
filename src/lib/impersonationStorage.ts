// localStorage key holding the super admin's own tokens while impersonating.
// It must not outlive the impersonated session: useAuth clears it on sign-out
// and ImpersonationProvider drops it when another account is signed in.
export const IMPERSONATION_STORAGE_KEY = "medlab_superadmin_impersonation_state";

export function clearImpersonationStorage() {
  try {
    localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode, blocked site data): nothing to clear.
  }
}
