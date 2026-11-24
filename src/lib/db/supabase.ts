import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Db, Query, Storage, Table, UploadPlan } from "./types";
import { BUCKET } from "./types";

/**
 * Supabase backend. Uses the *user-scoped* client (anon key + user JWT), so Postgres RLS and
 * Storage policies are the real access boundary; `owner_id` filters here are defence in depth.
 * No service-role key is ever used by the app.
 */

function fail(error: { message: string } | null): never {
  throw new Error(error?.message ?? "Ошибка базы данных");
}

export function supabaseDb(client: SupabaseClient, ownerId: string): Db {
  return {
    async select(table, q?: Query) {
      let req = client.from(table).select("*").eq("owner_id", ownerId);
      for (const [k, v] of Object.entries(q?.where ?? {})) {
        req = v === null ? req.is(k, null) : req.eq(k, v);
      }
      if (q?.search?.q.trim()) {
        const needle = q.search.q.trim().replace(/[%,()]/g, " ");
        req = req.or(q.search.cols.map((c) => `${c}.ilike.%${needle}%`).join(","));
      }
      if (q?.order) req = req.order(q.order.col, { ascending: !!q.order.asc });
      if (q?.limit) req = req.limit(q.limit);
      const { data, error } = await req;
      if (error) fail(error);
      return (data ?? []) as never;
    },
    async get(table, id) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .eq("id", id)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (error) fail(error);
      return (data ?? null) as never;
    },
    async insert(table, values) {
      const { data, error } = await client
        .from(table)
        .insert({ ...values, owner_id: ownerId })
        .select()
        .single();
      if (error) fail(error);
      return data as never;
    },
    async update(table, id, values) {
      const { id: _i, owner_id: _o, created_at: _c, ...safe } = values;
      void _i;
      void _o;
      void _c;
      const { data, error } = await client
        .from(table)
        .update(safe)
        .eq("id", id)
        .eq("owner_id", ownerId)
        .select()
        .single();
      if (error) fail(error);
      return data as never;
    },
    async remove(table: Table, id: string) {
      const { error } = await client.from(table).delete().eq("id", id).eq("owner_id", ownerId);
      if (error) fail(error);
    },
    async count(table, where) {
      let req = client.from(table).select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
      for (const [k, v] of Object.entries(where ?? {})) {
        req = v === null ? req.is(k, null) : req.eq(k, v);
      }
      const { count, error } = await req;
      if (error) fail(error);
      return count ?? 0;
    },
  };
}

export function supabaseStorage(client: SupabaseClient, ownerId: string): Storage {
  const own = (p: string) => {
    if (!p.startsWith(`${ownerId}/`)) throw new Error("Доступ к чужому файлу запрещён");
    return p;
  };
  const bucket = () => client.storage.from(BUCKET);
  return {
    async put(p, bytes, contentType) {
      const { error } = await bucket().upload(own(p), bytes, { contentType, upsert: false });
      if (error) fail(error);
    },
    async get(p) {
      const { data, error } = await bucket().download(own(p));
      if (error || !data) return null;
      return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type };
    },
    async exists(p) {
      const { data, error } = await bucket().createSignedUrl(own(p), 5);
      return !error && !!data;
    },
    async signedUrl(p, expiresInSec = 600) {
      const { data, error } = await bucket().createSignedUrl(own(p), expiresInSec);
      if (error || !data) fail(error);
      return data.signedUrl;
    },
    async createUpload(p): Promise<UploadPlan> {
      const { data, error } = await bucket().createSignedUploadUrl(own(p));
      if (error || !data) fail(error);
      return { kind: "supabase", bucket: BUCKET, path: p, token: data.token };
    },
    async remove(p) {
      const { error } = await bucket().remove([own(p)]);
      if (error) fail(error);
    },
  };
}
