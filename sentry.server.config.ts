// Server-side Sentry init — runs in every Node.js serverless function
// and Route Handler. Uses the private DSN (not NEXT_PUBLIC_*) so Vercel
// can scope quotas/alerts separately from the browser SDK.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? "development",
  // Most of our `catch {}` blocks swallow transient issues (rate-limit
  // outage, email send fail, etc). If they log via console.warn we can
  // still reach them — Sentry's console integration captures warns by
  // default, so no manual plumbing is needed for fail-open paths.
});
