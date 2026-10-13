import { createHmac, timingSafeEqual } from "node:crypto";
import { asPlainText } from "@/lib/chat";
import { AgentError, reply } from "./agent";
import { beginTextTurn, saveReply, setTextStopped, undoTurn } from "./conversation";
import { DbError } from "./db";

/**
 * The texting side of Wally: takes a text from a provider, answers it with
 * the same agent and the same thread as the website, and sends the answer
 * back the way it came.
 *
 * Two providers, one shape: Sendblue carries iMessage (blue bubbles, with SMS
 * as its own fallback), Twilio carries plain SMS. Either or both can be
 * switched on; a reply always leaves through the provider the text came in by.
 * Adding another provider means one more `send` branch and one more route.
 */
export type Provider = "sendblue" | "twilio";

export interface Inbound {
  provider: Provider;
  /** The sender's 10-digit US number, as accounts store it. */
  from: string;
  text: string;
  /** The provider's id for this delivery, used to drop repeats. */
  id: string | null;
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** A Messaging Service SID (MG…) or a phone number in E.164 form. */
  from: string;
}
interface SendblueConfig {
  keyId: string;
  secretKey: string;
  from: string;
}

const env = (name: string) => process.env[name]?.trim() || null;

export function twilioTexting(): TwilioConfig | null {
  const accountSid = env("TWILIO_ACCOUNT_SID");
  const authToken = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_MESSAGING_SERVICE_SID") ?? env("TWILIO_FROM_NUMBER");
  return accountSid && authToken && from ? { accountSid, authToken, from } : null;
}

export function sendblueTexting(): SendblueConfig | null {
  const keyId = env("SENDBLUE_API_KEY_ID");
  const secretKey = env("SENDBLUE_API_SECRET_KEY");
  const from = env("SENDBLUE_FROM_NUMBER");
  return keyId && secretKey && from ? { keyId, secretKey, from } : null;
}

// SENDBLUE_API_BASE points tests at a stand-in server.
const sendblueBase = () => env("SENDBLUE_API_BASE")?.replace(/\/+$/, "") ?? "https://api.sendblue.co";

/** "+1 (310) 555-0142" to "3105550142". Null for anything that isn't a US number. */
export function usPhone(raw: unknown): string | null {
  const digits = typeof raw === "string" ? raw.replace(/\D/g, "") : "";
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^[2-9]\d{9}$/.test(ten) ? ten : null;
}

/** The words carriers require every texting service to honour, whatever else is going on. */
export function keywordOf(text: string): "stop" | "start" | "help" | null {
  const word = text.trim().toUpperCase().replace(/[.!]+$/, "");
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(word)) return "stop";
  if (["START", "UNSTOP"].includes(word)) return "start";
  if (["HELP", "INFO"].includes(word)) return "help";
  return null;
}

/** Long answers go as several texts, broken at line ends where possible. */
export function chunks(body: string, max = 1400): string[] {
  const parts: string[] = [];
  let rest = body.trim();
  while (rest.length > max) {
    const cut = rest.lastIndexOf("\n", max);
    const at = cut > max / 2 ? cut : rest.lastIndexOf(" ", max) > 0 ? rest.lastIndexOf(" ", max) : max;
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/**
 * Twilio signs each webhook: HMAC-SHA1, keyed by the auth token, over the
 * full URL followed by every posted field (name then value, sorted by name).
 */
export function twilioSignatureValid(url: string, params: Record<string, string>, signature: string, authToken: string): boolean {
  const data = Object.keys(params).sort().reduce((all, key) => all + key + params[key], url);
  const expected = Buffer.from(createHmac("sha1", authToken).update(data, "utf8").digest("base64"));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** True if the two secrets match, compared in constant time. */
export function sameSecret(given: string | null | undefined, expected: string): boolean {
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Sends one text. `media` is the address of a file to attach. False if it didn't go. */
async function sendOne(provider: Provider, to: string, body: string, media?: string): Promise<boolean> {
  try {
    if (provider === "twilio") {
      const cfg = twilioTexting();
      if (!cfg) return false;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: `+1${to}`, [cfg.from.startsWith("MG") ? "MessagingServiceSid" : "From"]: cfg.from, Body: body, ...(media ? { MediaUrl: media } : {}) }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      // Status only: the body can echo the message.
      if (!res.ok) console.error(`[text] twilio send ${res.status}`);
      return res.ok;
    }
    const cfg = sendblueTexting();
    if (!cfg) return false;
    const res = await fetch(`${sendblueBase()}/api/send-message`, {
      method: "POST",
      headers: { "sb-api-key-id": cfg.keyId, "sb-api-secret-key": cfg.secretKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: `+1${to}`, from_number: cfg.from, ...(body ? { content: body } : {}), ...(media ? { media_url: media } : {}) }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error(`[text] sendblue send ${res.status}`);
    return res.ok;
  } catch (cause) {
    console.error(`[text] ${provider} send: no response`, cause instanceof Error ? cause.name : "");
    return false;
  }
}

/** Sends a message, in order, as as many texts as it needs. */
export async function sendText(provider: Provider, to: string, body: string): Promise<boolean> {
  for (const part of chunks(body)) if (!(await sendOne(provider, to, part))) return false;
  return true;
}

/** Shows the three dots in iMessage while Wally works. Plain SMS has no such thing. */
function showTyping(provider: Provider, to: string): void {
  const cfg = provider === "sendblue" ? sendblueTexting() : null;
  if (!cfg) return;
  void fetch(`${sendblueBase()}/api/send-typing-indicator`, {
    method: "POST",
    headers: { "sb-api-key-id": cfg.keyId, "sb-api-secret-key": cfg.secretKey, "Content-Type": "application/json" },
    body: JSON.stringify({ number: `+1${to}`, from_number: cfg.from }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

// Fixed wording: these are notices, not conversation (see "Conventions" in CLAUDE.md).
const NOTICE = {
  unknown: (origin: string) => `Hi, I'm Wally, an AI waiter. I don't know this number yet. Sign up, or add this number to your account, at ${origin}/join and then text me again.`,
  hello: "Wally here, your AI waiter. Save my contact card so you know it's me. Everything we say here also shows up at wallywaiter.com. Reply STOP to stop texts, HELP for help.",
  stopped: "You won't get any more texts from Wally. Reply START to turn them back on.",
  started: "Texts from Wally are back on. What can I get you?",
  help: (origin: string) => `Wally is an AI waiter for food questions and finding places. Manage your account at ${origin}/account. Reply STOP to stop texts.`,
  limited: "You've reached today's message limit, so that one wasn't answered. The limit resets within 24 hours.",
  wordsOnly: "I can only read words for now. Tell me what you're after.",
  failed: "Wally couldn't answer just now. Please send that again in a moment.",
};

/**
 * Answers one text. Never throws: whatever happens, the provider has already
 * been told the delivery arrived, and a failure is logged, not retried
 * (a retry could answer twice).
 */
export async function handleInbound(inbound: Inbound, origin: string): Promise<void> {
  const { provider, from } = inbound;
  const text = inbound.text.trim().slice(0, 2000);
  try {
    const keyword = keywordOf(text);
    if (keyword === "stop" || keyword === "start") {
      const known = await setTextStopped(from, keyword === "stop");
      // Twilio answers STOP and START itself, at the carrier's insistence. iMessage has no such layer.
      if (known && provider !== "twilio") await sendText(provider, from, keyword === "stop" ? NOTICE.stopped : NOTICE.started);
      return;
    }
    if (keyword === "help") {
      if (provider !== "twilio") await sendText(provider, from, NOTICE.help(origin));
      return;
    }
    if (!text) {
      await sendText(provider, from, NOTICE.wordsOnly);
      return;
    }

    const begun = await beginTextTurn(from, text, inbound.id);
    if (begun.status === "duplicate" || begun.status === "stopped") return;
    if (begun.status === "unknown") {
      // Someone who isn't a member wrote first. One plain answer, and nothing is kept.
      await sendText(provider, from, NOTICE.unknown(origin));
      return;
    }
    if (begun.status === "limited") {
      await sendText(provider, from, NOTICE.limited);
      return;
    }
    if (begun.status !== "ok") return;

    const { account } = begun;
    if (begun.first) {
      // The first text: say who he is, that he's an AI, and hand over his contact card.
      await sendText(provider, from, NOTICE.hello);
      await sendOne(provider, from, "", `${origin}/wally.vcf`);
    }
    showTyping(provider, from);
    try {
      const answer = await reply(begun.messages, { name: account.name, zip: account.zip, near: account.near, address: account.address }, "text", { onText: () => {} });
      const saved = await saveReply(account.id, "text", answer.content, answer.choices);
      if (saved) await sendText(provider, from, asPlainText(answer));
    } catch (error) {
      // Take the unanswered text back out of the thread, as the website does.
      await undoTurn(account.id, begun.id).catch(() => {});
      if (!(error instanceof AgentError) && !(error instanceof DbError)) console.error("[text]", error instanceof Error ? error.name : "unknown error");
      await sendText(provider, from, NOTICE.failed);
    }
  } catch (error) {
    console.error("[text] not handled:", error instanceof DbError ? "database" : error instanceof Error ? error.name : "unknown error");
  }
}
