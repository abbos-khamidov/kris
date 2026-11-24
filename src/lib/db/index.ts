import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCAL_COOKIE, readSession } from "@/lib/auth/local";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { localDb, localStorage } from "./local";
import { supabaseDb, supabaseStorage } from "./supabase";
import type { Ctx } from "./types";

export const backendMode = () => (isSupabaseConfigured() ? "supabase" : "local");

/** Returns the authenticated context or null. Cached per request. */
export const getCtxOrNull = cache(async (): Promise<Ctx | null> => {
  if (isSupabaseConfigured()) {
    const client = await createSupabaseServer();
    // getUser() validates the JWT with Supabase Auth (getSession() would trust the cookie).
    const { data } = await client.auth.getUser();
    if (!data.user) return null;
    const user = { id: data.user.id, email: data.user.email ?? "" };
    return {
      mode: "supabase",
      user,
      db: supabaseDb(client, user.id),
      storage: supabaseStorage(client, user.id),
    };
  }
  const user = await readSession((await cookies()).get(LOCAL_COOKIE)?.value);
  if (!user) return null;
  return { mode: "local", user, db: localDb(user.id), storage: localStorage(user.id) };
});

/** For pages and actions: redirects to /login when unauthenticated. */
export async function getCtx(): Promise<Ctx> {
  const ctx = await getCtxOrNull();
  if (!ctx) redirect("/login");
  return ctx;
}
