import { after } from "next/server";
import { appOrigin } from "@/lib/server/session";
import { handleInbound, twilioSignatureValid, usPhone } from "@/lib/server/texting";

// Wally's answer is worked out after Twilio has been told the text arrived.
export const maxDuration = 120;

/**
 * Twilio calls this when someone texts Wally's SMS number. In the Twilio
 * console, set the number's (or Messaging Service's) incoming-message webhook
 * to POST https://<domain>/api/text/twilio. APP_URL must be that same origin,
 * because Twilio's signature covers the exact address it called.
 */
export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) return new Response("Texting isn't switched on.", { status: 503 });
  const form = await request.formData().catch(() => null);
  if (!form) return new Response("Bad request", { status: 400 });
  const params: Record<string, string> = {};
  for (const [key, value] of form) if (typeof value === "string") params[key] = value;

  const origin = appOrigin(request);
  if (!twilioSignatureValid(`${origin}/api/text/twilio`, params, request.headers.get("x-twilio-signature") ?? "", authToken)) {
    return new Response("Signature doesn't match.", { status: 403 });
  }
  const from = usPhone(params.From);
  if (from) after(() => handleInbound({ provider: "twilio", from, text: params.Body ?? "", id: params.MessageSid ? `twilio:${params.MessageSid}` : null }, origin));
  // An empty reply: Wally answers with a message of his own once he has one.
  return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
}
