// Pure helpers used by both server components and the client-side
// ViewSwitcher. Kept in a non-"use client" file so server callers can
// invoke them directly — Next.js refuses to call exports from a
// "use client" module server-side.

export type ViewName = "table" | "kanban" | "roadmap" | "gantt" | "whiteboard";

export const ALL_VIEWS: ViewName[] = [
  "table",
  "kanban",
  "roadmap",
  "gantt",
  "whiteboard",
];

// Maps the Prisma `ViewType` enum (uppercase) onto the lowercase ViewName
// used in URLs and in Workspace.enabledViews JSON.
export function viewTypeToName(type: string): ViewName | null {
  switch (type.toUpperCase()) {
    case "TABLE":
      return "table";
    case "KANBAN":
      return "kanban";
    case "ROADMAP":
      return "roadmap";
    case "GANTT":
      return "gantt";
    case "WHITEBOARD":
      return "whiteboard";
    default:
      return null;
  }
}

// Parse Workspace.enabledViews (Json) into typed ViewName[]. Falls back
// to all views when the field is missing / malformed.
export function parseEnabledViews(raw: unknown): ViewName[] {
  if (!Array.isArray(raw)) return ALL_VIEWS;
  const out: ViewName[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const name = viewTypeToName(entry);
    if (name && !out.includes(name)) out.push(name);
  }
  return out.length > 0 ? out : ALL_VIEWS;
}
