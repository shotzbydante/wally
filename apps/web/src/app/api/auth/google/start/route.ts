import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appOrigin, sessionSecret } from "@/lib/server/session";

export async function GET(request: Request) {
  const origin = appOrigin(request);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !sessionSecret()) {
    return NextResponse.redirect(`${origin}/signin?error=google_not_configured`, 303);
  }
  // "?link=1" comes from the account page: add Google to the signed-in account.
  const link = new URL(request.url).searchParams.get("link") === "1";
  const state = randomBytes(24).toString("base64url") + (link ? ".link" : "");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();

  const res = NextResponse.redirect(url, 303);
  res.cookies.set("wally_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
