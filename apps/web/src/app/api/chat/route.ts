import { NextResponse, after } from "next/server";
import { MAX_MESSAGE_CHARS, type ChatEvent } from "@/lib/chat";
import { AgentError, agentConfigured, reply } from "@/lib/server/agent";
import { loadAccount } from "@/lib/server/accounts";
import { answerShape, flushAnalytics, queryText, track, viaOf } from "@/lib/server/analytics";
import { beginTurn, clearMessages, loadMessages, saveReply, undoTurn } from "@/lib/server/conversation";
import { DbError } from "@/lib/server/db";
import { placesConfigured } from "@/lib/server/places";
import { SESSION_COOKIE, decodeSession, sessionSecret } from "@/lib/server/session";

// A turn with web searches can take a while.
export const maxDuration = 120;

const json = (error: string, status: number) => NextResponse.json({ error }, { status });

const tokenOf = (request: Request) =>
  (request.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);

/** The signed-in account, if it lives in the database. Chat needs one to keep the thread. */
async function signedIn(request: Request) {
  const loaded = await loadAccount(tokenOf(request), sessionSecret());
  if (loaded.state === "unavailable") return { error: json("unavailable", 503) };
  if (loaded.state !== "ok" || loaded.kept !== "database" || !loaded.account.id) return { error: json("signed_out", 401) };
  return { account: loaded.account, id: loaded.account.id };
}

function validTimeZone(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 64) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}

/** The conversation so far. */
export async function GET(request: Request) {
  // The page asks for this every few seconds, so the thread is read alongside the account
  // check, not after it. The id comes from the signed cookie; if the account turns out to
  // be gone, the thread read is thrown away.
  const secret = sessionSecret();
  const id = secret ? decodeSession(tokenOf(request), secret)?.id : undefined;
  const thread = id ? loadMessages(id) : null;
  thread?.catch(() => {});
  const who = await signedIn(request);
  if ("error" in who) return who.error;
  try {
    return NextResponse.json({
      messages: await (thread ?? loadMessages(who.id)),
      // The address bar reads these, so it is right even on a page that was loaded a while ago.
      address: who.account.address ?? null,
      places: placesConfigured(),
    });
  } catch (error) {
    if (error instanceof DbError) return json("unavailable", 503);
    throw error;
  }
}

/** Says something to Wally. The answer streams back as one JSON event per line. */
export async function POST(request: Request) {
  // A plain HTML form can't send JSON, so this keeps other sites from posting as the person.
  if (!request.headers.get("content-type")?.includes("application/json")) return json("invalid_input", 400);
  const who = await signedIn(request);
  if ("error" in who) return who.error;
  const body = (await request.json().catch(() => null)) as { message?: unknown; timeZone?: unknown; via?: unknown } | null;
  const text = typeof body?.message === "string" ? body.message.trim() : "";
  if (!text || text.length > MAX_MESSAGE_CHARS) return json("invalid_input", 400);
  if (!agentConfigured()) return json("not_configured", 503);

  let begun;
  try {
    begun = await beginTurn(who.id, "web", text);
  } catch (error) {
    if (error instanceof DbError) return json("unavailable", 503);
    throw error;
  }
  if (begun.status === "gone") return json("signed_out", 401);
  // Events are delivered once the answer has gone out, so they never hold it up.
  after(flushAnalytics);
  if (begun.status === "limited") {
    track(who.id, "message_limited", { channel: "web" });
    return json("limited", 429);
  }
  const turn = begun;
  const asked = Date.now();
  track(who.id, "message_sent", {
    channel: "web",
    via: viaOf(body?.via),
    ...queryText(text),
    // The thread as Wally reads it, this message included: 1 means it opened the conversation.
    thread_length: turn.messages.length,
    has_address: Boolean(who.account.address),
    $set: { uses_web: true, last_channel: "web", has_address: Boolean(who.account.address) },
    $set_once: { first_channel: "web" },
  });
  const guest = { id: who.id, name: who.account.name, zip: who.account.zip, near: who.account.near, address: who.account.address, timeZone: validTimeZone(body?.timeZone) };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // If the person closes the page, keep going so the answer is still saved.
      const send = (event: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {}
      };
      try {
        const answer = await reply(turn.messages, guest, "web", {
          onText: (chunk) => send({ type: "text", text: chunk }),
          onSearch: () => send({ type: "searching" }),
        });
        const saved = await saveReply(who.id, "web", answer.content, answer.choices);
        track(who.id, "wally_replied", { channel: "web", seconds: Math.round((Date.now() - asked) / 100) / 10, ...answerShape(answer.choices) });
        send(saved ? { type: "done", message: saved } : { type: "error", error: "signed_out" });
      } catch (error) {
        // Take the unanswered message back out of the thread; the page keeps the words to resend.
        await undoTurn(who.id, turn.id).catch(() => {});
        track(who.id, "wally_failed", {
          channel: "web",
          reason: error instanceof AgentError ? error.reason : error instanceof DbError ? "unavailable" : "failed",
          seconds: Math.round((Date.now() - asked) / 100) / 10,
        });
        if (error instanceof AgentError) send({ type: "error", error: error.reason });
        else if (error instanceof DbError) send({ type: "error", error: "unavailable" });
        else {
          console.error("[chat]", error instanceof Error ? error.name : "unknown error");
          send({ type: "error", error: "failed" });
        }
      }
      try {
        controller.close();
      } catch {}
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

/** Erases the conversation. */
export async function DELETE(request: Request) {
  const who = await signedIn(request);
  if ("error" in who) return who.error;
  try {
    await clearMessages(who.id);
    track(who.id, "conversation_cleared");
    after(flushAnalytics);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DbError) return json("unavailable", 503);
    throw error;
  }
}
