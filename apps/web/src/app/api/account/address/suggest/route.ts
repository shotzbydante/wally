import { NextResponse } from "next/server";
import { loadAccount } from "@/lib/server/accounts";
import { PlacesError, placesConfigured, suggestAddresses } from "@/lib/server/places";
import { SESSION_COOKIE, sessionSecret } from "@/lib/server/session";

const none = () => NextResponse.json({ suggestions: [] }, { headers: { "Cache-Control": "no-store" } });

/**
 * Addresses that match what the person has typed so far, for the address bar.
 * Signed-in only, since each lookup is billed. Any failure answers with no
 * suggestions: the bar still works by typing the whole address and saving.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const typed = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  const session = url.searchParams.get("session") ?? "";
  if (typed.length < 3 || typed.length > 200 || !placesConfigured()) return none();

  const header = request.headers.get("cookie") ?? "";
  const token = header.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const loaded = await loadAccount(token, sessionSecret());
  if (loaded.state !== "ok") return NextResponse.json({ error: "signed_out" }, { status: 401 });

  try {
    const suggestions = await suggestAddresses(typed, { near: loaded.account.near, session: /^[\w-]{8,64}$/.test(session) ? session : undefined });
    return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PlacesError) return none();
    throw error;
  }
}
