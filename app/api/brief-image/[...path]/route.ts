// F12-K12: serve obrazy z briefów przez signed redirect. URL osadzony
// w contentJson briefu ma postać `/api/brief-image/w/<wid>/briefs/<bid>/...`
// — handler weryfikuje workspace membership użytkownika i 302-redirectuje
// na świeży signed download URL z Supabase Storage. Dzięki temu signed
// URL nigdy nie wycieka do persystowanego dokumentu (gdyby tak było,
// wygasłby po 1h i obrazy by się popsuły w briefie).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBriefImageDownloadUrl } from "@/app/(app)/w/[workspaceId]/briefs/actions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { path } = await params;
  const storageKey = path.join("/");
  if (!storageKey) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const signedUrl = await getBriefImageDownloadUrl(storageKey, session.user.id);
  if (!signedUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 302 → przeglądarka cachuje na chwilę; po wygaśnięciu dostaje nowy
  // signed URL przy kolejnym uderzeniu w handler.
  return NextResponse.redirect(signedUrl, 302);
}
