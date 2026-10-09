import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanFirstName } from "@/lib/signup";
import { appOrigin, sessionFromRequest, sessionSecret, setSession } from "@/lib/server/session";

const STATE_COOKIE = "wally_oauth_state";

function cookie(request: Request, name: string): string | null {
  const found = (request.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

export async function GET(request: Request) {
  const origin = appOrigin(request);
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${origin}/signin?error=${code}`, 303);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
    return res;
  };

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const secret = sessionSecret();
  if (!clientId || !clientSecret || !secret) return fail("google_not_configured");

  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const expected = cookie(request, STATE_COOKIE);
  if (!code || !state || !expected) return fail("google_failed");
  const a = Buffer.from(state);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail("google_failed");

  // The ID token comes straight from Google over TLS in exchange for our
  // client secret, so its claims can be read without checking the signature.
  let claims: { aud?: string; email?: string; email_verified?: boolean; given_name?: string; name?: string };
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    if (!tokenRes.ok) return fail("google_failed");
    const { id_token } = (await tokenRes.json()) as { id_token?: string };
    const payload = id_token?.split(".")[1];
    if (!payload) return fail("google_failed");
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return fail("google_failed");
  }
  if (claims.aud !== clientId || !claims.email || claims.email_verified !== true) return fail("google_failed");

  const res = NextResponse.redirect(`${origin}/account`, 303);
  res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
  setSession(
    res,
    sessionFromRequest(request, secret),
    { email: claims.email.toLowerCase(), google: true, name: cleanFirstName(claims.given_name ?? claims.name ?? "") },
    secret,
  );
  return res;
}
