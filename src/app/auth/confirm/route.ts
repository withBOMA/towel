import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext, withParams } from "@/lib/utils";

/**
 * `next` may be a path ("/invite/abc") or, from the email template, the full
 * redirect URL ("https://app/auth/confirm?next=%2Finvite%2Fabc"). Only same-origin
 * targets are allowed.
 */
function resolveNext(raw: string | null, origin: string): string {
  if (!raw) return safeNext(null);
  if (raw.startsWith("/")) return safeNext(raw);
  try {
    const url = new URL(raw);
    if (url.origin !== origin) return safeNext(null);
    if (url.pathname === "/auth/confirm") return safeNext(url.searchParams.get("next"));
    return safeNext(`${url.pathname}${url.search}`);
  } catch {
    return safeNext(null);
  }
}

/**
 * Landing route for links in auth emails.
 * - token_hash + type: works even if the link opens in a different browser (recommended template).
 * - code: the default PKCE link, which only works in the browser that requested it.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = resolveNext(searchParams.get("next"), origin);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) return NextResponse.redirect(new URL(next, origin));

  return NextResponse.redirect(
    new URL(
      withParams("/login", { next, error: "That sign-in link has expired or was already used. Request a new one." }),
      origin,
    ),
  );
}
