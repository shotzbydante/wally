import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/server/accounts";
import { DbError, dbConfigured } from "@/lib/server/db";
import { SESSION_COOKIE, appOrigin, sessionFromRequest, sessionSecret } from "@/lib/server/session";

/** Erases the signed-in account and signs out. */
export async function POST(request: Request) {
  const origin = appOrigin(request);
  const secret = sessionSecret();
  const session = secret ? sessionFromRequest(request, secret) : null;
  if (session?.id && dbConfigured()) {
    try {
      await deleteAccount(session.id);
    } catch (error) {
      // Stay signed in: nothing was erased.
      if (error instanceof DbError) return NextResponse.redirect(`${origin}/account?problem=erase`, 303);
      throw error;
    }
  }
  const res = NextResponse.redirect(`${origin}/`, 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
