// Rate limiting via Upstash Redis + sliding window.
//
// Limiters are lazy-initialised and reused across requests. When the
// Upstash env is absent (local dev without keys) or Redis is unreachable
// we FAIL OPEN — rate limiting is a safety net, not an authorization
// layer. A transient Redis outage must not lock everyone out.
//
// No `import "server-only"` — we want smoke tests to drive this module
// directly via tsx. Real callers are either Server Actions or
// server-only libs (auth.ts), so client-side misuse isn't a realistic
// risk. The Upstash client reads env vars that don't exist in the
// browser anyway.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type LimiterName =
  | "auth.login"
  // F12-K43 M4: dedykowany limit na recovery codes — login z TOTP fallback
  // przeszedł 10 prób bcrypt'a per request. User z 10 leaked codes mógłby
  // burn'ować je bez jakiegokolwiek alarmu.
  | "auth.recoveryCode"
  | "comment.create"
  | "task.create"
  | "task.sendEmail"
  | "workspace.invite";

interface LimiterSpec {
  tokens: number;
  window: `${number} ${"s" | "m" | "h" | "d"}`;
  // Short human-friendly description — exposed to the UI on rejection.
  friendly: string;
}

const SPECS: Record<LimiterName, LimiterSpec> = {
  // Login: tight. Per (IP + typed email), so a single bad actor can't
  // brute force one address and an unrelated user's attempts aren't
  // blocked by someone else's mistakes.
  "auth.login": { tokens: 5, window: "15 m", friendly: "5 prób na 15 minut" },
  // 3 próby na 30 minut — typowy user wpisuje recovery code raz; więcej
  // prób = wskazuje na brute force. Tokens=3 < liczba codes (10), więc
  // user który zgubi pamięć nie może wszystkich na raz testować.
  "auth.recoveryCode": { tokens: 3, window: "30 m", friendly: "3 próby na 30 minut" },
  "comment.create": { tokens: 30, window: "1 m", friendly: "30 komentarzy/min" },
  "task.create": { tokens: 30, window: "1 m", friendly: "30 zadań/min" },
  "task.sendEmail": { tokens: 10, window: "1 h", friendly: "10 wysyłek/godz" },
  "workspace.invite": {
    tokens: 20,
    window: "1 h",
    friendly: "20 zaproszeń/godz na przestrzeń",
  },
};

const redisSingleton = (() => {
  let cached: Redis | null = null;
  let attempted = false;
  return () => {
    if (attempted) return cached;
    attempted = true;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    try {
      cached = new Redis({ url, token });
    } catch {
      cached = null;
    }
    return cached;
  };
})();

const limiters = new Map<LimiterName, Ratelimit>();

function getLimiter(name: LimiterName): Ratelimit | null {
  const existing = limiters.get(name);
  if (existing) return existing;
  const redis = redisSingleton();
  if (!redis) return null;
  const spec = SPECS[name];
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(spec.tokens, spec.window),
    analytics: false,
    prefix: `ratelimit:${name}`,
  });
  limiters.set(name, rl);
  return rl;
}

export type LimitResult =
  | { ok: true; remaining: number }
  | { ok: false; error: string; resetMs: number };

// Returns ok=true when the request should proceed. If Upstash is unavailable
// we fail open (ok=true, remaining=-1 so callers can tell).
export async function checkLimit(
  name: LimiterName,
  key: string,
): Promise<LimitResult> {
  const rl = getLimiter(name);
  if (!rl) return { ok: true, remaining: -1 };
  try {
    const res = await rl.limit(key);
    if (res.success) return { ok: true, remaining: res.remaining };
    const resetMs = Math.max(0, res.reset - Date.now());
    return {
      ok: false,
      error: `Zbyt wiele prób — ${SPECS[name].friendly}.`,
      resetMs,
    };
  } catch (e) {
    // Log and fail open — outages shouldn't lock users out.
    console.warn(`[rate-limit] ${name} check failed:`, e instanceof Error ? e.message : e);
    return { ok: true, remaining: -1 };
  }
}
