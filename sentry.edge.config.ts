// Edge runtime Sentry init — runs inside Middleware (proxy.ts) and any
// edge-runtime Route Handlers. Uses the same server DSN since the alert
// surface is the same (server-side code, just a different runtime).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.05,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? "development",
});
