// F12-K34: Vercel cron — raz dziennie tworzy snapshot każdego workspace'u
// (`vercel.json`: schedule "0 1 * * *" = 01:00 UTC = 02:00 CET / 03:00 CEST).
// Idempotent: jeśli backup dla danego dnia już istnieje, skip.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { ATTACHMENTS_BUCKET, supabaseAdmin } from "@/lib/storage";
import {
  buildWorkspaceBackup,
  polishDayKey,
} from "@/lib/workspace-backup";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const dayKey = polishDayKey(new Date());
  const workspaces = await db.workspace.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { workspaceId: string; error: string }[] = [];

  for (const ws of workspaces) {
    try {
      // Idempotent — already-snapshotted today? skip.
      const existing = await db.workspaceBackup.findUnique({
        where: { workspaceId_dayKey: { workspaceId: ws.id, dayKey } },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const payload = await buildWorkspaceBackup(ws.id);
      // BigInt + Date round-trip — JSON.stringify domyślnie nie obsługuje
      // BigInt-ów (Workspace.storageUsedBytes), więc replacer.
      const json = JSON.stringify(payload, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      );
      const buf = new TextEncoder().encode(json);
      const storageKey = `w/${ws.id}/backups/${dayKey}.json`;

      const { error: uploadError } = await supabaseAdmin()
        .storage.from(ATTACHMENTS_BUCKET)
        .upload(storageKey, buf, {
          contentType: "application/json",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      await db.workspaceBackup.create({
        data: {
          workspaceId: ws.id,
          dayKey,
          storageKey,
          sizeBytes: buf.byteLength,
          modelCounts: payload.counts as Prisma.InputJsonValue,
        },
      });
      created++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ workspaceId: ws.id, error: msg });
      console.error(`[backup] workspace ${ws.id}:`, msg);
    }
  }

  return NextResponse.json({
    ok: true,
    dayKey,
    total: workspaces.length,
    created,
    skipped,
    failed,
    errors,
  });
}
