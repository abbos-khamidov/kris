/** Data-layer contracts. Domain code depends only on these interfaces (ADR-001). */

export const TABLES = [
  "profiles",
  "patients",
  "patient_anamnesis",
  "consultations",
  "patient_cards",
  "card_versions",
  "products",
  "product_categories",
  "recommendation_templates",
  "procedures",
  "media_assets",
  "patient_photos",
  "generated_documents",
  "activity_logs",
  "follow_ups",
  "settings",
  "pdf_imports",
  "knowledge_candidates",
] as const;
export type Table = (typeof TABLES)[number];

export type Row = { id: string; owner_id: string; created_at: string; updated_at: string } & Record<
  string,
  unknown
>;

export type Where = Record<string, string | number | boolean | null>;

export interface Query {
  where?: Where;
  /** Case-insensitive substring search over the listed text columns. */
  search?: { cols: string[]; q: string };
  order?: { col: string; asc?: boolean };
  limit?: number;
}

/** All operations are implicitly scoped to the authenticated owner. */
export interface Db {
  select<T = Row>(table: Table, q?: Query): Promise<(T & Row)[]>;
  get<T = Row>(table: Table, id: string): Promise<(T & Row) | null>;
  insert<T = Row>(table: Table, values: Record<string, unknown>): Promise<T & Row>;
  update<T = Row>(table: Table, id: string, values: Record<string, unknown>): Promise<T & Row>;
  remove(table: Table, id: string): Promise<void>;
  count(table: Table, where?: Where): Promise<number>;
}

/** How a browser uploads a file directly to private storage (never through a serverless function). */
export type UploadPlan =
  | { kind: "supabase"; bucket: string; path: string; token: string }
  | { kind: "local"; url: string; path: string };

export interface Storage {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(path: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  exists(path: string): Promise<boolean>;
  signedUrl(path: string, expiresInSec?: number): Promise<string>;
  createUpload(path: string): Promise<UploadPlan>;
  remove(path: string): Promise<void>;
}

export interface SessionUser {
  id: string;
  email: string;
}

export interface Ctx {
  mode: "supabase" | "local";
  user: SessionUser;
  db: Db;
  storage: Storage;
}

export const BUCKET = "kris-private";
