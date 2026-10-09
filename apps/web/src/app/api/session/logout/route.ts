import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/session";

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
