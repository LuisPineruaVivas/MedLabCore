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
