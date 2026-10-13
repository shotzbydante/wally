import { after } from "next/server";
import { appOrigin } from "@/lib/server/session";
import { handleInbound, sameSecret, usPhone } from "@/lib/server/texting";

export const maxDuration = 120;

interface Delivery {
  content?: string;
  is_outbound?: boolean;
  status?: string;
  message_handle?: string;
  from_number?: string;
  number?: string;
  group_id?: string;
  media_url?: string;
}

/**
 * Sendblue calls this when someone messages Wally's iMessage line. In the
 * Sendblue dashboard, set the "receive" webhook to
 * POST https://<domain>/api/text/sendblue?key=<SENDBLUE_WEBHOOK_SECRET>.
 * The key in the address is how the call is known to be Sendblue's; the same
 * value is also accepted as Sendblue's own webhook secret header.
 */
export async function POST(request: Request) {
  const secret = process.env.SENDBLUE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.warn("[text] sendblue webhook: not switched on (no SENDBLUE_WEBHOOK_SECRET)");
    return new Response("Texting isn't switched on.", { status: 503 });
  }
  const key = new URL(request.url).searchParams.get("key") ?? request.headers.get("sb-signing-secret");
  if (!sameSecret(key, secret)) {
    // Lengths only: enough to spot a mangled or missing key, nothing of the key itself.
    console.warn(`[text] sendblue webhook: key doesn't match (got ${key?.length ?? 0} characters, expected ${secret.length})`);
    return new Response("Key doesn't match.", { status: 403 });
  }

  const delivery = (await request.json().catch(() => null)) as Delivery | null;
  // Only a message from a person, one to one. Group threads are a later phase (see the product brief).
  const from = delivery && !delivery.is_outbound && delivery.status === "RECEIVED" && !delivery.group_id ? usPhone(delivery.from_number ?? delivery.number) : null;
  // What kind of delivery it was, never what it said or who sent it.
  console.log(`[text] sendblue webhook: ${from ? "accepted" : "ignored"} (status ${delivery?.status ?? "none"}, outbound ${Boolean(delivery?.is_outbound)}, group ${Boolean(delivery?.group_id)})`);
  if (from) {
    const origin = appOrigin(request);
    after(() => handleInbound({ provider: "sendblue", from, text: delivery!.content ?? "", id: delivery!.message_handle ? `sendblue:${delivery!.message_handle}` : null }, origin));
  }
  return Response.json({ ok: true });
}
