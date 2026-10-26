/**
 * Password rule for accounts created in the app (improvement plan S-08). The same rule
 * is enforced by the edge functions (supabase/functions/_shared/password.ts) and by
 * Supabase Auth (minimum_password_length / password_requirements).
 */
export const MIN_PASSWORD_LENGTH = 10;

export const PASSWORD_RULE_TEXT = `Minimo ${MIN_PASSWORD_LENGTH} caracteres, con letras y numeros.`;

/** Spanish error message, or null when the password meets the rule. */
export function getPasswordError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "La contrasena debe incluir letras y numeros.";
  }
  return null;
}
