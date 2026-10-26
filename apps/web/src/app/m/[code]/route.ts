import { mapLinkFor } from "@/lib/chat";

/**
 * Short map links for texts: /m/5xK9mQ2aBcD opens the place on Google Maps.
 * The code is the place's Maps number in base 62 (see shortMapLink), or its
 * place ID after "p."; it only ever leads to Google Maps.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = mapLinkFor(code.slice(0, 120));
  if (!link) return new Response("Not found", { status: 404 });
  return Response.redirect(link, 302);
}
