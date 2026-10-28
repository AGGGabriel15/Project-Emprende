import * as Sentry from "@sentry/nextjs";

// Sentry solo se activa si existe NEXT_PUBLIC_SENTRY_DSN.
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}

export const onRequestError = Sentry.captureRequestError;
