import { NextResponse, after } from "next/server";
import { claimSignInLink, signIn } from "@/lib/server/accounts";
import { flushAnalytics } from "@/lib/server/analytics";
import { DbError } from "@/lib/server/db";
import { appOrigin, readToken, sessionFromRequest, sessionSecret } from "@/lib/server/session";

/**
 * Opening the emailed link does not sign anyone in or use the link up. Mail
 * apps and their link scanners fetch every link in a message before, or just
 * as, the person taps it (Gmail's in-app browser did, on 2026-11-24), and a
 * link that worked once was spent by that fetch: the person then saw "already
 * been used" on a link they had never opened. So the GET only answers with a
 * small page with one button that sends the same address back as a POST,
 * and the POST is what signs in. The page does not submit itself: a browser
 * that loads the link twice would spend it just the same. Nothing fetches a
 * page and presses its button except the person.
 */
export async function GET(request: Request) {
  const origin = appOrigin(request);
  const secret = sessionSecret();
  const token = new URL(request.url).searchParams.get("token");
  if (!secret || !token || !readToken<{ exp: number }>("email-link", token, secret)) return NextResponse.redirect(`${origin}/signin?error=link_expired`, 303);
  return new Response(CONFIRM_PAGE, {
    // The address holds the link's token: keep it out of caches and out of the Referer of anything the page loads.
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" },
  });
}

/** Styles are inline: this page is served by the route itself, without the site's stylesheet. The form has no action, so it posts to the address it was opened at, token and all. */
const CONFIRM_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sign in · Wally</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6fa;color:#161a2b;font-family:system-ui,-apple-system,sans-serif">
<form method="post" style="margin:1.5rem;padding:2rem;max-width:22rem;width:100%;background:#fff;border-radius:1.5rem;box-shadow:0 1px 3px rgba(22,26,43,.12);text-align:center">
<h1 style="margin:0 0 .5rem;font-size:1.5rem">Sign in to Wally</h1>
<p style="margin:0 0 1.5rem;color:#596078">Tap the button to finish signing in on this device.</p>
<button type="submit" style="width:100%;padding:.9rem 1rem;border:0;border-radius:999px;background:#0e7c57;color:#fff;font:inherit;font-weight:600;cursor:pointer">Sign in</button>
</form>
</body>
</html>`;

/** Signs in with the link, once. Sent by the page above. */
export async function POST(request: Request) {
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
  if (!(await signIn(res, request, { email: link.email }, secret, { linkTo, method: "email" }))) return fail("unavailable");
  after(flushAnalytics);
  return res;
}
