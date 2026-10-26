// Password rule for accounts created by the edge functions (improvement plan S-08).
// Same rule as src/lib/passwordPolicy.ts; checked here so it cannot be bypassed.

export const MIN_PASSWORD_LENGTH = 10;

/** Spanish error message, or null when the password meets the rule. */
export function getPasswordError(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `La contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "La contrasena debe incluir letras y numeros.";
  }
  return null;
}
