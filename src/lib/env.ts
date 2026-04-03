export const env = {
  mode: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  enableSentry: import.meta.env.PROD && Boolean(import.meta.env.VITE_SENTRY_DSN),
  sentryTraceSampleRate: import.meta.env.PROD ? 0.2 : 1,
  sentryReplaySessionSampleRate: import.meta.env.PROD ? 0.02 : 0,
  sentryReplayOnErrorSampleRate: import.meta.env.PROD ? 0.2 : 1,
};
