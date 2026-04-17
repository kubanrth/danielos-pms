"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Nieprawidłowy adres email."),
  password: z.string().min(1, "Wpisz hasło."),
  redirectTo: z.string().default("/workspaces"),
});

type FieldErrors = { email?: string; password?: string };

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
    redirectTo: formData.get("redirectTo") || "/workspaces",
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "email" || k === "password") fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: parsed.data.redirectTo,
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Nieprawidłowy email lub hasło." };
      }
      return { error: "Logowanie nie powiodło się. Spróbuj ponownie." };
    }
    throw error;
  }
}
