import { z } from "zod";

// Short curated timezone list covering PL clients + common remote collaborators.
// (Full IANA list is 400+ — we don't need it for an internal PL tool yet.)
export const TIMEZONES = [
  "Europe/Warsaw",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Athens",
  "Europe/Moscow",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
] as const;

export type Timezone = (typeof TIMEZONES)[number];

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Wpisz swoje imię.")
  .max(80, "Imię jest za długie.");

export const updateProfileSchema = z.object({
  name: nameSchema,
  timezone: z.enum(TIMEZONES).default("Europe/Warsaw" as Timezone),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
