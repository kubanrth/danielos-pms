// Next.js instrumentation entry — wires Sentry's server + edge configs
// on startup. Runs once per process before any route handler.
//
// Client-side init lives in sentry.client.config.ts and is pulled in
// automatically by the Sentry Next.js SDK via the client bundle.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Hook for request errors — surfaces them in Sentry even when the app
// swallows them in its own error boundary. Called by Next 15+ on any
// unhandled error in a React Server Component or route handler.
export const onRequestError = Sentry.captureRequestError;
