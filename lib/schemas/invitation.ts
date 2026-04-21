import { z } from "zod";
import { Role } from "@/lib/generated/prisma/enums";

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Nieprawidłowy email."),
  role: z.nativeEnum(Role).default(Role.MEMBER),
});

export const changeRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.nativeEnum(Role),
});

export const removeMemberSchema = z.object({
  membershipId: z.string().min(1),
});

export const cancelInviteSchema = z.object({
  invitationId: z.string().min(1),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków.").max(128),
  name: z.string().trim().min(1, "Podaj imię.").max(80).optional(),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
