import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PREFIXES = ["/login", "/api/files/", "/_next", "/icons", "/fonts"];
const PUBLIC_EXACT = ["/manifest.webmanifest", "/sw.js", "/favicon.ico"];

const isPublic = (p: string) => PUBLIC_EXACT.includes(p) || PUBLIC_PREFIXES.some((x) => p.startsWith(x));

/** Route guard. Real authorization is re-checked on every data access (getCtx); this is the first gate. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request });
  let signedIn: boolean;

  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    // getClaims verifies the JWT signature locally (no network round-trip on every request).
    const { data } = await supabase.auth.getClaims();
    signedIn = !!data?.claims?.sub;
  } else {
    signedIn = !!request.cookies.get("kris_session")?.value;
  }

  if (!signedIn && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|webp|ico|ttf|woff2?)$).*)"],
};
