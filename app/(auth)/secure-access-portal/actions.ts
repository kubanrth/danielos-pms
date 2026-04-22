"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Nieprawidłowy adres email."),
  password: z.string().min(1, "Wpisz hasło."),
  // Optional — only users with 2FA enabled need to fill it. Accepts
  // both a 6-digit TOTP token and an XXXX-XXXX-XXXX recovery code.
  totp: z.string().optional(),
  redirectTo: z.string().default("/workspaces"),
});

type FieldErrors = { email?: string; password?: string; totp?: string };

export type LoginState = {
  error?: string;
  fieldErrors?: FieldErrors;
} | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totp: formData.get("totp") ?? "",
    redirectTo: formData.get("redirectTo") || "/workspaces",
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "email" || k === "password" || k === "totp") fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      totp: parsed.data.totp ?? "",
      redirectTo: parsed.data.redirectTo,
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        // Intentionally vague — we don't tell the attacker whether the
        // password was wrong, the 2FA code was missing, or the account
        // has 2FA enabled at all.
        return { error: "Nieprawidłowy email, hasło lub kod 2FA." };
      }
      return { error: "Logowanie nie powiodło się. Spróbuj ponownie." };
    }
    throw error;
  }
}
