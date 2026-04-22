// F9a: Sentry wiring sanity.
//
// The SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN env slots are declared but
// empty in local .env — production Vercel has real values. With an
// empty DSN the Sentry SDK init is a no-op, so nothing is sent and
// we can still run the app locally without credentials.
//
// This smoke loads sentry.server.config.ts in the same way Next's
// instrumentation hook does, then pokes captureException to confirm
// the SDK is silently swallowing (no throw, no network).
import "dotenv/config";
import * as Sentry from "@sentry/nextjs";

async function main() {
  const dsn = process.env.SENTRY_DSN;
  console.log("[0] SENTRY_DSN set?", !!dsn, "(len:", dsn?.length ?? 0, ")");

  // Load the same init path that instrumentation.ts uses on Node runtime.
  await import("../sentry.server.config");

  const client = Sentry.getClient();
  const dsnUsed = client?.getDsn()?.host ?? null;
  console.log("[1] Sentry client present:", !!client, "dsn.host:", dsnUsed);

  // In fail-open mode (no DSN), captureException should quietly no-op.
  // Emit one and verify neither call throws — flush returns true either
  // way (an empty transport resolves trivially).
  Sentry.captureException(new Error("smoke-f9a: should be swallowed with empty DSN"));
  const flushed = await Sentry.flush(2000);
  console.log("[2] captureException + flush completed:", flushed);

  if (dsn) {
    console.log("     [DSN is set — Sentry is actually transmitting this run]");
  } else {
    console.log("     [no DSN — SDK is a no-op, matches .env default]");
  }
  console.log("DONE — F9a Sentry wiring 2/2");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
