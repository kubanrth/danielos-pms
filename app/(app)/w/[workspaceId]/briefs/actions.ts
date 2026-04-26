"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction, requireWorkspaceMembership } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import {
  ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
  createSignedUploadUrl,
  isImageMime,
  supabaseAdmin,
} from "@/lib/storage";

// F11-21 (#25): Creative brief CRUD. Tworzenie wymaga membership;
// edycja/usuwanie creator + admin (task.update perm).

const createSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
});

// F12-K13: bogaty ClickUp-style design brief template. Rozbudowany na
// żądanie klienta — z tabelami (deliverables / brand colors / timeline /
// team) i pełnym 1:1 zakresem sekcji typowego design brief'u.
//
// Tiptap JSON jest verbose, więc poniższe helpery składają strukturę
// czytelnie. Templates podmieniamy w jednym miejscu (TEMPLATE_DOC).

type TT = Record<string, unknown>;

function h2(emoji: string, text: string): TT {
  return {
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text: `${emoji} ${text}` }],
  };
}
function h3(text: string): TT {
  return {
    type: "heading",
    attrs: { level: 3 },
    content: [{ type: "text", text }],
  };
}
function p(text: string): TT {
  return text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };
}
function ul(items: string[]): TT {
  return {
    type: "bulletList",
    content: items.map((t) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
    })),
  };
}
function tcell(text: string, isHeader = false): TT {
  return {
    type: isHeader ? "tableHeader" : "tableCell",
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
  };
}
function tr(cells: string[], isHeader = false): TT {
  return {
    type: "tableRow",
    content: cells.map((c) => tcell(c, isHeader)),
  };
}
function table(headerCells: string[], bodyRows: string[][]): TT {
  return {
    type: "table",
    content: [tr(headerCells, true), ...bodyRows.map((r) => tr(r))],
  };
}

const TEMPLATE_DOC = {
  type: "doc",
  content: [
    // ── Header / cel
    h2("🎯", "Cel projektu"),
    p(
      "Krótko o co chodzi w tym projekcie. Jaki problem rozwiązujemy, dlaczego TERAZ, co po jego ukończeniu się zmieni dla biznesu i odbiorcy.",
    ),

    // ── Kontekst
    h2("📋", "Kontekst i tło"),
    p(
      "Sytuacja wyjściowa, dotychczasowa komunikacja, ostatnie zmiany, ograniczenia (regulacyjne, brandowe, techniczne). Linki do dokumentów / Slack threadów / poprzednich kampanii.",
    ),

    // ── Cele biznesowe
    h2("✅", "Cele projektu"),
    ul([
      "Cel 1 — mierzalny rezultat (np. +15% CTR w newsletterze)",
      "Cel 2 — jakościowy rezultat (np. spójna identyfikacja na 5 touchpointach)",
      "Cel 3 — internal goal (np. szybsza onboarding'owa ścieżka dla designerów)",
    ]),

    // ── Grupa docelowa
    h2("👥", "Grupa docelowa"),
    p(
      "Kto jest odbiorcą — segment + 2-3 persony, ich potrzeby, frustracje, język. Czego po nas oczekują, gdzie nas spotkają, na jakim urządzeniu.",
    ),

    // ── Deliverables
    h2("📦", "Deliverables"),
    p("Co dokładnie ma być oddane. Format pliku, wymiary, ilość wariantów."),
    table(
      ["Element", "Format / wymiary", "Notatki"],
      [
        ["Logo", "SVG, PNG @1×/2×", "Wersja podstawowa + wer. monochromatyczna"],
        ["Web banner", "1920×600 px", "Hero strona główna"],
        ["Social post", "1080×1080 px", "5 wariantów na launch"],
      ],
    ),

    // ── Brand
    h2("🎨", "Brand & visual identity"),
    h3("Kolory marki"),
    table(
      ["Nazwa", "Hex", "Zastosowanie"],
      [
        ["Primary", "#7B68EE", "CTA, akcenty, key states"],
        ["Accent", "#10B981", "Success, positive states"],
        ["Ink", "#1F2937", "Body text, ikony"],
        ["Paper", "#F8FAFC", "Tła, surface'y"],
      ],
    ),
    h3("Typografia"),
    ul([
      "Display (nagłówki) — np. Söhne / Inter Display",
      "Body (treść) — np. Inter / system-ui",
      "Mono (eyebrow, kod) — np. JetBrains Mono",
    ]),
    h3("Tone of voice"),
    p(
      "Bezpośredni, konkretny, bez korpomowy. Czego unikać: superlatywów, klisz typu „rewolucyjny\", emoji w copy. Co preferujemy: aktywny czas, krótkie zdania, listy.",
    ),

    // ── Timeline
    h2("📅", "Timeline & milestones"),
    table(
      ["Etap", "Daty", "Deliverable"],
      [
        ["Discovery", "T1–T2", "Notatki research, mood-board"],
        ["Koncepcja", "T3", "3 kierunki, mocki low-fi"],
        ["Iteracja", "T4–T5", "Wybrany kierunek + revisions"],
        ["Launch", "T6", "Pliki finalne, handoff"],
      ],
    ),

    // ── Zespół
    h2("👤", "Zespół i role"),
    table(
      ["Osoba", "Rola", "Kontakt"],
      [
        ["", "Creative Director / Approver", ""],
        ["", "Designer (lead)", ""],
        ["", "Stakeholder biznesowy", ""],
      ],
    ),

    // ── Referencje
    h2("🔗", "Referencje i inspiracje"),
    p(
      "Linki do mood-boardów, konkurencji, dribbble/behance, screenshoty. Co podoba się i dlaczego — co odrzucamy i dlaczego.",
    ),
    ul([
      "Inspiracja 1 — link + dlaczego pasuje",
      "Inspiracja 2 — link + co bierzemy stąd",
      "Czego unikać — link + dlaczego nie",
    ]),

    // ── Success metrics
    h2("📊", "Success metrics"),
    ul([
      "Metryka biznesowa (np. konwersja, CTR, NPS)",
      "Metryka jakościowa (np. spójność, feedback od stakeholderów)",
      "Termin oceny (np. 4 tygodnie po launchu)",
    ]),

    // ── Otwarte pytania
    h2("❓", "Otwarte pytania"),
    p(
      "Co jest jeszcze niejasne, kto musi odpowiedzieć, do kiedy. Lista TODO żeby brief był 'gotów do startu'.",
    ),
    p(""),
  ],
};

export async function createBriefAction(formData: FormData) {
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceMembership(parsed.data.workspaceId);

  const brief = await db.creativeBrief.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      creatorId: ctx.userId,
      title: parsed.data.title,
      contentJson: TEMPLATE_DOC as Prisma.InputJsonValue,
    },
  });
  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Workspace",
    objectId: parsed.data.workspaceId,
    actorId: ctx.userId,
    action: "creativeBrief.created",
    diff: { briefId: brief.id, title: parsed.data.title },
  });
  redirect(`/w/${parsed.data.workspaceId}/briefs/${brief.id}`);
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(200).optional(),
  contentJson: z.string().max(200_000).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"]).optional(),
  emoji: z.string().max(8).optional(),
  headerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function updateBriefAction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title") ?? undefined,
    contentJson: formData.get("contentJson") ?? undefined,
    status: formData.get("status") ?? undefined,
    emoji: formData.get("emoji") ?? undefined,
    headerColor: formData.get("headerColor") ?? undefined,
  });
  if (!parsed.success) return;

  const brief = await db.creativeBrief.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, workspaceId: true, creatorId: true },
  });
  if (!brief) return;
  // Creator can update own; admins (task.update) can update any.
  const ctx = await requireWorkspaceAction(brief.workspaceId, "task.update");

  const data: Prisma.CreativeBriefUncheckedUpdateInput = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.contentJson !== undefined && parsed.data.contentJson !== "") {
    try {
      const doc = JSON.parse(parsed.data.contentJson);
      if (doc && typeof doc === "object") data.contentJson = doc as Prisma.InputJsonValue;
    } catch {
      /* skip */
    }
  }
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.emoji !== undefined) data.emoji = parsed.data.emoji || null;
  if (parsed.data.headerColor !== undefined) data.headerColor = parsed.data.headerColor;

  if (Object.keys(data).length === 0) return;

  await db.creativeBrief.update({ where: { id: brief.id }, data });
  await writeAudit({
    workspaceId: brief.workspaceId,
    objectType: "Workspace",
    objectId: brief.workspaceId,
    actorId: ctx.userId,
    action: "creativeBrief.updated",
    diff: { briefId: brief.id, fields: Object.keys(data) },
  });
  revalidatePath(`/w/${brief.workspaceId}/briefs/${brief.id}`);
  revalidatePath(`/w/${brief.workspaceId}/briefs`);
}

export async function deleteBriefAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const brief = await db.creativeBrief.findUnique({
    where: { id },
    select: { id: true, workspaceId: true },
  });
  if (!brief) return;
  const ctx = await requireWorkspaceAction(brief.workspaceId, "task.update");

  await db.creativeBrief.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    workspaceId: brief.workspaceId,
    objectType: "Workspace",
    objectId: brief.workspaceId,
    actorId: ctx.userId,
    action: "creativeBrief.deleted",
    diff: { briefId: id },
  });
  redirect(`/w/${brief.workspaceId}/briefs`);
}

// F12-K12: image upload do briefu. Reuse Supabase Storage `attachments`
// bucket (ten sam co task attachments) ale pod ścieżką `briefs/`.
// Klient dostaje signed upload URL, przesyła plik, potem inserts <img>
// z `src=/api/brief-image/<encoded-key>` — route-handler weryfikuje
// access do briefu na każdy request i zwraca świeży signed download URL
// (eliminuje problem expiry'i osadzonych URLi w contentJson).

const uploadImageSchema = z.object({
  briefId: z.string().min(1),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export type BriefImageUploadResult =
  | { ok: true; uploadUrl: string; storageKey: string; publicSrc: string }
  | { ok: false; error: string };

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/]/g, "_")
      .replace(/[^\w.\-]/g, "_")
      .replace(/_+/g, "_")
      .slice(-120) || "image"
  );
}

export async function requestBriefImageUploadAction(
  briefId: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
): Promise<BriefImageUploadResult> {
  const parsed = uploadImageSchema.safeParse({ briefId, filename, contentType, sizeBytes });
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowe parametry pliku." };
  }
  if (!isImageMime(parsed.data.contentType)) {
    return { ok: false, error: "Wymagany obraz (PNG / JPEG / WebP / GIF)." };
  }

  const brief = await db.creativeBrief.findFirst({
    where: { id: parsed.data.briefId, deletedAt: null },
    select: { id: true, workspaceId: true, creatorId: true },
  });
  if (!brief) return { ok: false, error: "Brief nie istnieje." };

  // Authoring permission: creator OR workspace admin (task.update).
  const ctx = await requireWorkspaceMembership(brief.workspaceId);
  const isCreator = ctx.userId === brief.creatorId;
  const isAdmin = ctx.role === "ADMIN" || ctx.role === "MEMBER";
  if (!isCreator && !isAdmin) {
    return { ok: false, error: "Brak uprawnień do edycji briefu." };
  }

  const safe = sanitizeFilename(parsed.data.filename);
  const rand = randomBytes(9).toString("base64url");
  const storageKey = `w/${brief.workspaceId}/briefs/${brief.id}/${rand}-${safe}`;

  try {
    const signed = await createSignedUploadUrl(storageKey);
    return {
      ok: true,
      uploadUrl: signed.signedUrl,
      storageKey,
      // Route handler weryfikuje access przy każdym GET i 302-redirectuje
      // na świeży signed download URL.
      publicSrc: `/api/brief-image/${encodeURI(storageKey)}`,
    };
  } catch (err) {
    console.warn("[brief-image] signed upload failed", err);
    return { ok: false, error: "Nie udało się przygotować uploadu." };
  }
}

// Rzadko wołana — używana TYLKO z route-handlera /api/brief-image gdy
// chcemy zwrócić signed download URL bez exportowania `supabaseAdmin`
// poza serwer.
export async function getBriefImageDownloadUrl(
  storageKey: string,
  userId: string,
): Promise<string | null> {
  // Storage key formie: w/<wid>/briefs/<bid>/<rand-name>
  const parts = storageKey.split("/");
  if (parts.length < 5 || parts[0] !== "w" || parts[2] !== "briefs") return null;
  const workspaceId = parts[1];
  const briefId = parts[3];

  const brief = await db.creativeBrief.findFirst({
    where: { id: briefId, workspaceId, deletedAt: null },
    select: { id: true, creatorId: true, workspaceId: true },
  });
  if (!brief) return null;

  // Reader = każdy workspace member. Brief jest workspace-wide,
  // tak jak teraz lista /briefs. Brak per-brief ACL.
  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  });
  if (!membership) return null;

  const { data, error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storageKey, 60 * 60); // 1h
  if (error || !data) return null;
  return data.signedUrl;
}
