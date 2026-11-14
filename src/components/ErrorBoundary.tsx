import { useEffect, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStaleChunkError, reloadForNewVersion } from "@/lib/reloadForNewVersion";

function ErrorFallback({ error, resetError, fullPage }: { error: unknown; resetError: () => void; fullPage: boolean }) {
  const staleChunk = isStaleChunkError(error);

  useEffect(() => {
    if (staleChunk) reloadForNewVersion();
  }, [staleChunk]);

  return (
    <div className={fullPage ? "flex min-h-screen items-center justify-center bg-background p-4" : "flex justify-center py-16"}>
      <div role="alert" className="max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Algo salió mal</h2>
          <p className="text-sm text-muted-foreground">
            {staleChunk
              ? "Hay una nueva versión del sistema. Recarga la página para continuar."
              : "Ocurrió un error inesperado en esta pantalla. Ya fue reportado; puedes intentarlo de nuevo."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {fullPage || staleChunk ? (
            <Button onClick={() => window.location.reload()}>
              <RotateCcw className="mr-2 h-4 w-4" /> Recargar
            </Button>
          ) : (
            <Button onClick={resetError}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reintentar
            </Button>
          )}
          <Button variant="outline" onClick={() => window.location.assign("/")}>
            <Home className="mr-2 h-4 w-4" /> Ir al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Catches render errors so a crash shows a message instead of a blank page, and reports them to Sentry.
 * `fullPage` is the last-resort boundary around the whole app; the default one wraps a single page.
 */
export function ErrorBoundary({ children, fullPage = false }: { children: ReactNode; fullPage?: boolean }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => <ErrorFallback error={error} resetError={resetError} fullPage={fullPage} />}
      beforeCapture={(scope) => scope.setTag("boundary", fullPage ? "app" : "page")}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
