// One-shot bucket setup. Idempotent — safe to re-run after schema tweaks.
// Uses the service role key so it can manage buckets at the project level.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "attachments";
const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
];
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY required");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: listErr } = await admin.storage.listBuckets();
  if (listErr) throw listErr;
  const hit = existing.find((b) => b.name === BUCKET);

  if (!hit) {
    const { error } = await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (error) throw error;
    console.log(`[+] created bucket "${BUCKET}" (private, ${MAX_BYTES / 1024 / 1024}MB cap)`);
  } else {
    const { error } = await admin.storage.updateBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (error) throw error;
    console.log(`[~] updated bucket "${BUCKET}" (already existed)`);
  }

  const { data: verify } = await admin.storage.getBucket(BUCKET);
  console.log("verify:", {
    name: verify?.name,
    public: verify?.public,
    fileSizeLimit: verify?.file_size_limit,
    mimeCount: verify?.allowed_mime_types?.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
