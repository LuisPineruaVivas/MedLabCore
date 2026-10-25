export interface AppErrorPayload {
  message: string;
  technicalCode?: string;
  details?: unknown;
}

const DEFAULT_ERROR_MESSAGE = "Ocurrio un error inesperado. Intenta nuevamente.";

export function toAppError(error: unknown, fallbackMessage = DEFAULT_ERROR_MESSAGE): AppErrorPayload {
  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
      technicalCode: error.name,
    };
  }

  if (typeof error === "object" && error !== null) {
    const payload = error as { message?: string; code?: string; error?: string; details?: unknown };
    return {
      message: payload.message || payload.error || fallbackMessage,
      technicalCode: payload.code,
      details: payload.details,
    };
  }

  return {
    message: fallbackMessage,
  };
}

export function getUserFacingErrorMessage(error: unknown, fallbackMessage = DEFAULT_ERROR_MESSAGE) {
  return toAppError(error, fallbackMessage).message;
}

/**
 * Errors that will fail the same way on retry. Supabase PostgrestError has a
 * Postgres `code` but no HTTP `status`, so both are checked:
 * - HTTP 4xx (Auth / fetch errors that carry a status);
 * - PGRST*: PostgREST request errors (not found, bad filter, JWT…);
 * - P0001: `raise exception` from our RPCs (app error codes like ERP_*);
 * - 42*: permission denied / undefined objects; 22* / 23*: invalid data / constraints.
 * Network failures, timeouts and 5xx stay retryable.
 */
export function isNonRetryableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  if (typeof status === "number" && status >= 400 && status < 500) return true;
  return typeof code === "string" && /^(PGRST|P0001$|42|22|23)/.test(code);
}
