export const env = {
  mode: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  // "production" or "preview" on Vercel (set in vite.config.ts), the Vite mode elsewhere.
  sentryEnvironment: (import.meta.env.VITE_DEPLOY_ENV as string | undefined) || import.meta.env.MODE,
  enableSentry: import.meta.env.PROD && Boolean(import.meta.env.VITE_SENTRY_DSN),
};
