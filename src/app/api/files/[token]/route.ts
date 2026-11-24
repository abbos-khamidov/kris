import { NextResponse } from "next/server";
import { localReadFile, localWriteFile, verifyLocalToken } from "@/lib/db/local";
import { isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Local demo backend only: serves/accepts files through short-lived HMAC-signed URLs,
 * mirroring Supabase signed URLs. Disabled when Supabase is configured.
 */
const MAX_BYTES = 40 * 1024 * 1024;

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (isSupabaseConfigured()) return new NextResponse(null, { status: 404 });
  const payload = await verifyLocalToken(decodeURIComponent((await params).token), "r");
  if (!payload) return new NextResponse("Ссылка недействительна или истекла", { status: 403 });
  const file = await localReadFile(payload.path);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.contentType,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  if (isSupabaseConfigured()) return new NextResponse(null, { status: 404 });
  const payload = await verifyLocalToken(decodeURIComponent((await params).token), "w");
  if (!payload) return new NextResponse("Ссылка недействительна или истекла", { status: 403 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "Недопустимый размер файла" }, { status: 413 });
  }
  await localWriteFile(payload.path, bytes, req.headers.get("content-type") ?? "application/octet-stream");
  return NextResponse.json({ ok: true });
}
