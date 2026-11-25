import { after } from "next/server";
import { deliveryLinks } from "@/lib/chat";
import { flushAnalytics, isPreview, track } from "@/lib/server/analytics";

/**
 * Short links for texts: /go/doordash/tacos-el-parrillon opens that app's
 * search for the restaurant. A text can't carry a tidy link to a search (the
 * real address is long and full of %20), so Wally sends this one instead.
 * It only ever leads to the delivery apps' own search pages.
 */
export async function GET(request: Request, { params }: { params: Promise<{ app: string; slug: string }> }) {
  const { app, slug } = await params;
  const name = slug.replace(/-+/g, " ").trim().slice(0, 80);
  const link = name ? deliveryLinks(name).find((l) => l.app.toLowerCase().replace(/\s/g, "") === app) : undefined;
  if (!link) return new Response("Not found", { status: 404 });
  // These links only go out in texts, so an open is someone tapping through from one.
  if (!isPreview(request)) {
    track(null, "text_link_opened", { kind: app });
    after(flushAnalytics);
  }
  return Response.redirect(link.url, 302);
}
