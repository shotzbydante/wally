import { NextResponse } from "next/server";
import { upgradeSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { SESSION_COOKIE, appOrigin, sessionFromRequest, sessionSecret } from "@/lib/server/session";

/**
 * The account page sends a browser here when its cookie still holds the
 * profile itself, from before the database. The profile becomes an account
 * and the cookie is replaced with one that holds the account id.
 */
export async function GET(request: Request) {
  const origin = appOrigin(request);
  const secret = sessionSecret();
  const session = secret ? sessionFromRequest(request, secret) : null;
  if (!secret || !session) return NextResponse.redirect(`${origin}/signin`, 303);
  const res = NextResponse.redirect(`${origin}/account`, 303);
  if (session.id || !dbConfigured()) return res;

  const result = await upgradeSession(res, session, secret);
  if (result === "ok") return res;
  const out = NextResponse.redirect(`${origin}/signin${result === "unavailable" ? "?error=unavailable" : ""}`, 303);
  // Nothing verified to keep: the cookie is no use any more.
  if (result === "nothing") out.cookies.delete(SESSION_COOKIE);
  return out;
}
