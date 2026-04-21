"use server";

import bcrypt from "bcrypt";
import { auth, signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { acceptInviteSchema } from "@/lib/schemas/invitation";
import { writeAudit } from "@/lib/audit";
import { AuthError } from "next-auth";

type FieldErrors = { password?: string; name?: string };

export type AcceptInviteState =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: FieldErrors }
  | null;

export async function acceptInviteAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "password" || k === "name") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const invitation = await db.invitation.findUnique({
    where: { token: parsed.data.token },
    include: { workspace: { select: { id: true, name: true, deletedAt: true } } },
  });

  if (!invitation || invitation.workspace.deletedAt) {
    return { ok: false, error: "Zaproszenie nie istnieje lub zostało cofnięte." };
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Zaproszenie wygasło. Poproś admina o nowe." };
  }
  if (invitation.acceptedAt) {
    return { ok: false, error: "Zaproszenie zostało już wykorzystane." };
  }

  // Check whether an account for this email already exists.
  const existingUser = await db.user.findUnique({
    where: { email: invitation.email },
  });

  let userId: string;
  if (existingUser) {
    if (!existingUser.passwordHash) {
      return {
        ok: false,
        error: "To konto nie ma ustawionego hasła. Skontaktuj się z administratorem.",
      };
    }
    const valid = await bcrypt.compare(parsed.data.password, existingUser.passwordHash);
    if (!valid) {
      return { ok: false, fieldErrors: { password: "Nieprawidłowe hasło dla istniejącego konta." } };
    }
    userId = existingUser.id;
  } else {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const newUser = await db.user.create({
      data: {
        email: invitation.email,
        name: parsed.data.name ?? invitation.email.split("@")[0],
        passwordHash,
        emailVerified: new Date(), // invitation acceptance counts as email verification
      },
    });
    userId = newUser.id;
  }

  // Create membership + mark invite accepted.
  await db.$transaction([
    db.workspaceMembership.upsert({
      where: {
        workspaceId_userId: { workspaceId: invitation.workspaceId, userId },
      },
      update: { role: invitation.role },
      create: {
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
      },
    }),
    db.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  await writeAudit({
    workspaceId: invitation.workspaceId,
    objectType: "Workspace",
    objectId: invitation.workspaceId,
    actorId: userId,
    action: "workspace.inviteAccepted",
    diff: { email: invitation.email, role: invitation.role },
  });

  // Sign in — if already logged in as same email, skip. Otherwise perform fresh sign-in.
  const session = await auth();
  if (session?.user?.email === invitation.email) {
    return { ok: true };
  }

  try {
    await signIn("credentials", {
      email: invitation.email,
      password: parsed.data.password,
      redirectTo: `/w/${invitation.workspaceId}`,
    });
    return { ok: true }; // unreachable — signIn redirects
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Logowanie nie powiodło się. Spróbuj ponownie." };
    }
    throw error;
  }
}
