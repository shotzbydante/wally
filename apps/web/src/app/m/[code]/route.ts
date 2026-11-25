import { after } from "next/server";
import { mapLinkFor } from "@/lib/chat";
import { flushAnalytics, isPreview, track } from "@/lib/server/analytics";

/**
 * Short map links for texts: /m/5xK9mQ2aBcD opens the place on Google Maps.
 * The code is the place's Maps number in base 62 (see shortMapLink), or its
 * place ID after "p."; it only ever leads to Google Maps.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = mapLinkFor(code.slice(0, 120));
  if (!link) return new Response("Not found", { status: 404 });
  // These links only go out in texts, so an open is someone tapping through from one.
  if (!isPreview(request)) {
    track(null, "text_link_opened", { kind: "map" });
    after(flushAnalytics);
  }
  return Response.redirect(link, 302);
}
