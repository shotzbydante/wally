import { NextResponse } from "next/server";
import { claimSignInLink, signIn } from "@/lib/server/accounts";
import { DbError } from "@/lib/server/db";
import { appOrigin, readToken, sessionFromRequest, sessionSecret } from "@/lib/server/session";

export async function GET(request: Request) {
  const origin = appOrigin(request);
  const fail = (code: string) => NextResponse.redirect(`${origin}/signin?error=${code}`, 303);
  const secret = sessionSecret();
  const token = new URL(request.url).searchParams.get("token");
  const link = secret ? readToken<{ email: string; link?: string; exp: number }>("email-link", token, secret) : null;
  if (!secret || !token || !link) return fail("link_expired");

  try {
    if (!(await claimSignInLink(token, link.exp))) return fail("link_used");
  } catch (error) {
    if (error instanceof DbError) return fail("unavailable");
    throw error;
  }

  // A link that adds this email to an account only does so in the browser that asked for it.
  // Otherwise anyone signed in could mail a "sign-in link" to someone else's address and,
  // when they opened it, fold that person's account into their own. Elsewhere it is a plain sign-in.
  const linkTo = link.link && sessionFromRequest(request, secret)?.id === link.link ? link.link : undefined;
  const res = NextResponse.redirect(link.link && !linkTo ? `${origin}/account?problem=link_elsewhere` : `${origin}/account`, 303);
  if (!(await signIn(res, request, { email: link.email }, secret, { linkTo }))) return fail("unavailable");
  return res;
}
