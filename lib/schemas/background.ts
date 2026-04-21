import { z } from "zod";

export const backgroundSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({
      kind: z.literal("color"),
      value: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Kolor w formacie #RRGGBB."),
    }),
    z.object({
      kind: z.literal("gradient"),
      // Two stops: from + to, plus an angle in degrees.
      from: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      to: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      angle: z.number().int().min(0).max(360),
    }),
    z.object({
      kind: z.literal("image"),
      url: z.string().url("Podaj prawidłowy URL obrazu."),
    }),
  ])
  .or(z.null());

export const updateBackgroundSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  viewType: z.enum(["TABLE", "KANBAN", "ROADMAP"]),
  payload: z.string(), // JSON-stringified, parsed on the server
});

export type BackgroundConfig =
  | { kind: "none" }
  | { kind: "color"; value: string }
  | { kind: "gradient"; from: string; to: string; angle: number }
  | { kind: "image"; url: string };

export function backgroundToCss(bg: BackgroundConfig | null | undefined): string | undefined {
  if (!bg || bg.kind === "none") return undefined;
  if (bg.kind === "color") return bg.value;
  if (bg.kind === "gradient") return `linear-gradient(${bg.angle}deg, ${bg.from} 0%, ${bg.to} 100%)`;
  if (bg.kind === "image") return `center / cover no-repeat url("${bg.url}")`;
  return undefined;
}
