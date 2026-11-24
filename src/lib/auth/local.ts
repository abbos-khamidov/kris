import "server-only";
import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { localAppendRaw, localReadAll, localSecret } from "@/lib/db/local";
import type { Row, SessionUser } from "@/lib/db/types";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const LOCAL_COOKIE = "kris_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 14;

async function hash(password: string, salt = randomBytes(16)) {
  const key = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

async function verify(password: string, stored: string) {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export async function hasLocalUsers() {
  return (await localReadAll("profiles")).length > 0;
}

export async function createLocalUser(email: string, password: string, displayName: string) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const row = {
    id,
    owner_id: id,
    email: email.toLowerCase(),
    display_name: displayName,
    password_hash: await hash(password),
    created_at: now,
    updated_at: now,
  } as Row;
  await localAppendRaw("profiles", row);
  return { id, email: row.email as string };
}

export async function checkLocalCredentials(email: string, password: string): Promise<SessionUser | null> {
  const users = await localReadAll("profiles");
  const u = users.find((x) => x.email === email.toLowerCase());
  // Always run a hash comparison to keep timing uniform for unknown emails.
  const ok = await verify(password, (u?.password_hash as string) ?? "00:00");
  return u && ok ? { id: u.id, email: u.email as string } : null;
}

export async function signSession(user: SessionUser) {
  const body = Buffer.from(
    JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC }),
  ).toString("base64url");
  const sig = createHmac("sha256", await localSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", await localSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionUser & { exp: number };
  if (p.exp < Date.now() / 1000) return null;
  // Session is only valid while the user still exists.
  const users = await localReadAll("profiles");
  return users.some((u) => u.id === p.id) ? { id: p.id, email: p.email } : null;
}

export const SESSION_MAX_AGE = SESSION_TTL_SEC;
