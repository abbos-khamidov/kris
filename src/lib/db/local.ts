import "server-only";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Db, Query, Row, Storage, Table, UploadPlan, Where } from "./types";
import { TABLES } from "./types";

/** Local demo backend: JSON files in .data/ (gitignored). Never used on Vercel. */

const ROOT = path.join(process.cwd(), ".data");
const DB_DIR = path.join(ROOT, "db");
const FILES_DIR = path.join(ROOT, "files");

let queue: Promise<unknown> = Promise.resolve();
/** Serialises read-modify-write cycles so concurrent requests cannot corrupt a table file. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readTable(table: string): Promise<Row[]> {
  try {
    return JSON.parse(await fs.readFile(path.join(DB_DIR, `${table}.json`), "utf8")) as Row[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeTable(table: string, rows: Row[]) {
  await fs.mkdir(DB_DIR, { recursive: true });
  const file = path.join(DB_DIR, `${table}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rows), "utf8");
  await fs.rename(tmp, file);
}

function assertTable(table: string): asserts table is Table {
  if (!(TABLES as readonly string[]).includes(table)) throw new Error(`Unknown table: ${table}`);
}

function matches(row: Row, where?: Where) {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => (row[k] ?? null) === v);
}

function applyQuery(rows: Row[], q?: Query): Row[] {
  let out = rows.filter((r) => matches(r, q?.where));
  if (q?.search?.q.trim()) {
    const needle = q.search.q.trim().toLowerCase();
    out = out.filter((r) =>
      q.search!.cols.some((c) => String(r[c] ?? "").toLowerCase().includes(needle)),
    );
  }
  if (q?.order) {
    const { col, asc } = q.order;
    out = [...out].sort((a, b) => {
      const x = a[col] as string | number | null;
      const y = b[col] as string | number | null;
      if (x === y) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : 1) * (asc ? 1 : -1);
    });
  }
  if (q?.limit) out = out.slice(0, q.limit);
  return out;
}

export function localDb(ownerId: string): Db {
  return {
    async select(table, q) {
      assertTable(table);
      const rows = (await readTable(table)).filter((r) => r.owner_id === ownerId);
      return applyQuery(rows, q) as never;
    },
    async get(table, id) {
      assertTable(table);
      const row = (await readTable(table)).find((r) => r.id === id && r.owner_id === ownerId);
      return (row ?? null) as never;
    },
    insert(table, values) {
      assertTable(table);
      return locked(async () => {
        const rows = await readTable(table);
        const now = new Date().toISOString();
        const row = {
          ...values,
          id: (values.id as string) ?? randomUUID(),
          owner_id: ownerId,
          created_at: now,
          updated_at: now,
        } as Row;
        rows.push(row);
        await writeTable(table, rows);
        return row as never;
      });
    },
    update(table, id, values) {
      assertTable(table);
      return locked(async () => {
        const rows = await readTable(table);
        const i = rows.findIndex((r) => r.id === id && r.owner_id === ownerId);
        if (i < 0) throw new Error("Запись не найдена");
        const { id: _i, owner_id: _o, created_at: _c, ...safe } = values;
        void _i;
        void _o;
        void _c;
        rows[i] = { ...rows[i], ...safe, updated_at: new Date().toISOString() } as Row;
        await writeTable(table, rows);
        return rows[i] as never;
      });
    },
    remove(table, id) {
      assertTable(table);
      return locked(async () => {
        const rows = await readTable(table);
        await writeTable(
          table,
          rows.filter((r) => !(r.id === id && r.owner_id === ownerId)),
        );
      });
    },
    async count(table, where) {
      assertTable(table);
      const rows = (await readTable(table)).filter((r) => r.owner_id === ownerId);
      return rows.filter((r) => matches(r, where)).length;
    },
  };
}

/* ---------- unscoped helpers used only by local auth ---------- */

export async function localReadAll(table: Table): Promise<Row[]> {
  return readTable(table);
}

export async function localAppendRaw(table: Table, row: Row): Promise<void> {
  await locked(async () => {
    const rows = await readTable(table);
    rows.push(row);
    await writeTable(table, rows);
  });
}

/* ---------- storage ---------- */

let secretCache: string | null = null;
export async function localSecret(): Promise<string> {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (secretCache) return secretCache;
  const file = path.join(ROOT, "secret.key");
  try {
    secretCache = (await fs.readFile(file, "utf8")).trim();
  } catch {
    await fs.mkdir(ROOT, { recursive: true });
    secretCache = randomUUID() + randomUUID();
    await fs.writeFile(file, secretCache, "utf8");
  }
  return secretCache;
}

function safePath(p: string) {
  const resolved = path.resolve(FILES_DIR, p);
  if (!resolved.startsWith(FILES_DIR + path.sep)) throw new Error("Недопустимый путь");
  return resolved;
}

export async function signLocalToken(
  payload: { path: string; exp: number; op: "r" | "w" },
): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", await localSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export async function verifyLocalToken(token: string, op: "r" | "w") {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", await localSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as {
    path: string;
    exp: number;
    op: string;
  };
  if (payload.exp < Date.now() / 1000 || payload.op !== op) return null;
  return payload;
}

export async function localWriteFile(p: string, bytes: Uint8Array, contentType: string) {
  const file = safePath(p);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
  await fs.writeFile(`${file}.meta`, contentType, "utf8");
}

export async function localReadFile(p: string) {
  const file = safePath(p);
  try {
    const bytes = new Uint8Array(await fs.readFile(file));
    const contentType = await fs.readFile(`${file}.meta`, "utf8").catch(() => "application/octet-stream");
    return { bytes, contentType };
  } catch {
    return null;
  }
}

export function localStorage(ownerId: string): Storage {
  const own = (p: string) => {
    if (!p.startsWith(`${ownerId}/`)) throw new Error("Доступ к чужому файлу запрещён");
    return p;
  };
  return {
    async put(p, bytes, contentType) {
      await localWriteFile(own(p), bytes, contentType);
    },
    async get(p) {
      return localReadFile(own(p));
    },
    async exists(p) {
      return (await localReadFile(own(p))) !== null;
    },
    async signedUrl(p, expiresInSec = 600) {
      const token = await signLocalToken({
        path: own(p),
        exp: Math.floor(Date.now() / 1000) + expiresInSec,
        op: "r",
      });
      return `/api/files/${encodeURIComponent(token)}`;
    },
    async createUpload(p): Promise<UploadPlan> {
      const token = await signLocalToken({
        path: own(p),
        exp: Math.floor(Date.now() / 1000) + 900,
        op: "w",
      });
      return { kind: "local", url: `/api/files/${encodeURIComponent(token)}`, path: p };
    },
    async remove(p) {
      const file = safePath(own(p));
      await fs.rm(file, { force: true });
      await fs.rm(`${file}.meta`, { force: true });
    },
  };
}
