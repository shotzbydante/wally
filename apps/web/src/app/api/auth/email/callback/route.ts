import { NextResponse } from "next/server";
import { appOrigin, readToken, sessionFromRequest, sessionSecret, setSession } from "@/lib/server/session";

export async function GET(request: Request) {
  const origin = appOrigin(request);
  const secret = sessionSecret();
  const link = secret
    ? readToken<{ email: string; exp: number }>("email-link", new URL(request.url).searchParams.get("token"), secret)
    : null;
  if (!secret || !link) return NextResponse.redirect(`${origin}/signin?error=link_expired`, 303);

  const res = NextResponse.redirect(`${origin}/account`, 303);
  setSession(res, sessionFromRequest(request, secret), { email: link.email }, secret);
  return res;
}
