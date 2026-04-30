import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkLimit } from "@/lib/rate-limit";
import { verifyRecoveryCode, verifyTotpToken } from "@/lib/totp";

// Augment session + user with our custom fields.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isSuperAdmin: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    isSuperAdmin?: boolean;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Optional — only required for users with 2FA enabled. Client sends
  // "" when the user isn't using 2FA; we normalise to undefined so the
  // branch below stays readable.
  totp: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/secure-access-portal",
    error: "/secure-access-portal",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Hasło", type: "password" },
        totp: { label: "Kod 2FA", type: "text" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Brute-force guard: rate-limit per typed email so a single
        // address can't be hammered. Anonymous / unknown emails are
        // limited the same way — a bot trying random emails will eat
        // its own budget on every one it tries.
        const rl = await checkLimit("auth.login", parsed.data.email.toLowerCase());
        if (!rl.ok) return null;

        const user = await db.user.findFirst({
          where: {
            email: parsed.data.email.toLowerCase(),
            deletedAt: null,
            isBanned: false,
          },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        // Second factor check. If the user has 2FA enabled, they must
        // provide either a valid TOTP token OR a one-use recovery code.
        // We deliberately return null (not a distinct error) when the
        // factor is missing/wrong — don't leak whether 2FA is on.
        if (user.totpEnabledAt && user.totpSecret) {
          const submitted = (parsed.data.totp ?? "").trim();
          if (submitted.length === 0) return null;

          const totpDelta = verifyTotpToken(user.totpSecret, submitted);
          if (totpDelta === null) {
            // Fall back to recovery codes. Fetch only unused ones.
            const codes = await db.totpRecoveryCode.findMany({
              where: { userId: user.id, usedAt: null },
              select: { id: true, codeHash: true },
            });
            const match = verifyRecoveryCode(
              submitted,
              codes.map((c) => c.codeHash),
            );
            if (match === null) return null;
            // Mark the used code so it can't be replayed.
            await db.totpRecoveryCode.update({
              where: { id: codes[match].id },
              data: { usedAt: new Date() },
            });
          }
        }

        await db.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
  callbacks: {
    // F12-K43 M1: explicit redirect callback. trustHost=true sprawi że
    // Auth.js domyślnie ufa Host header'owi z requestu — atakujący mógłby
    // teoretycznie zmusić signIn(redirectTo: 'https://evil.com') do
    // przepuszczenia external URL'a. Tu wymusamy: tylko relative
    // ścieżki ALBO same-origin z naszą APP_BASE_URL.
    redirect: async ({ url, baseUrl }) => {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const target = new URL(url, baseUrl);
        const allowed = process.env.APP_BASE_URL || baseUrl;
        const allowedOrigin = new URL(allowed).origin;
        if (target.origin === allowedOrigin) return target.toString();
      } catch {
        /* invalid URL → fallthrough do baseUrl */
      }
      return baseUrl;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.isSuperAdmin = user.isSuperAdmin ?? false;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isSuperAdmin = (token.isSuperAdmin as boolean | undefined) ?? false;
      }
      return session;
    },
  },
});
