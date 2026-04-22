// Client-side Sentry init — runs in the browser for every user.
//
// Fails open when NEXT_PUBLIC_SENTRY_DSN is empty (local dev without
// project credentials): Sentry's init with an empty DSN is a
// no-op, so the SDK loads but never sends. That keeps the code path
// identical between environments.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Low sample rate by default — pilot traffic is modest and we'd
  // rather catch every error than have elaborate sampling math.
  tracesSampleRate: 0.1,
  // Don't record session replays by default — they're expensive in
  // transport + privacy surface. Can turn on per-incident.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  // Tag releases with the Vercel commit SHA when available so a
  // regression bisects cleanly.
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  // Filter spammy breadcrumbs that don't help debug.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "console" && breadcrumb.level === "debug") return null;
    return breadcrumb;
  },
});
