"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { LocationBar } from "@/components/LocationBar";
import { Wally } from "@/components/Wally";
import { WallyFace, type WallyLook } from "@/components/WallyFace";
import { MAX_MESSAGE_CHARS, OPEN_BADGE_MINUTES, deliveryLinks, dollars, hostOf, isOwnSite, splitSources, type ChatEvent, type ChatMessage, type Choice, type TicketInfo } from "@/lib/chat";

/** What Wally is doing, which drives how he moves and what his bubble says. */
type Mood = "idle" | "thinking" | "speaking" | "sorry";

const starters = [
  { emoji: "🍜", label: "Help me pick dinner tonight" },
  { emoji: "🏡", label: "Great local spots near me" },
  { emoji: "🕯️", label: "Plan a date night" },
  { emoji: "🎟️", label: "How do I land a hard-to-get table?" },
];

const problems: Record<string, string> = {
  not_configured: "Wally isn’t switched on yet, so your message wasn’t sent.",
  limited: "You’ve reached today’s message limit. Your message wasn’t sent. The limit resets within 24 hours.",
  busy: "Wally is busy right now. Your message wasn’t sent. Try again in a moment.",
  unavailable: "Wally’s records didn’t respond. Your message wasn’t sent. Try again in a moment.",
  signed_out: "You’ve been signed out. Sign in again to keep talking to Wally.",
  invalid_input: `Messages can be up to ${MAX_MESSAGE_CHARS.toLocaleString("en-US")} characters.`,
  failed: "Wally couldn’t answer. Your message wasn’t sent. Try again.",
  network: "Couldn’t reach Wally. Check your connection and try again.",
  clear_failed: "The conversation wasn’t erased. Wally’s records didn’t respond. Try again in a moment.",
};

/** How his face passes the time between questions. */
const idleLooks: WallyLook[] = ["smile", "right", "smile", "wink", "left", "smile"];
/** What he says once he has answered. Which one depends on where the conversation is. */
const idleLines = ["At your service.", "What else can I get you?", "Ready when you are."];

const greeting = (name: string) => `Hi${name ? ` ${name}` : ""}, I’m Wally, your personal waiter. What can I serve up for you today?`;

const noSubscription = () => () => {};
const nearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 220;
const toBottom = (smooth: boolean) =>
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? "smooth" : "instant" });

export function AskWally({
  name,
  initial,
  ready,
  places: placesAtLoad,
  address: addressAtLoad,
}: {
  name: string;
  initial: ChatMessage[];
  ready: boolean;
  /** The places search is switched on, so an address is worth asking for. */
  places: boolean;
  address: string | null;
}) {
  const [messages, setMessages] = useState(initial);
  const [places, setPlaces] = useState(placesAtLoad);
  const [address, setAddress] = useState(addressAtLoad);
  const [draft, setDraft] = useState("");
  /** The person's message while Wally answers it, and his answer as it arrives. */
  const [pending, setPending] = useState<{ text: string; answer: string; searching: boolean } | null>(null);
  const [mood, setMood] = useState<Mood>("idle");
  const [error, setError] = useState<string | null>(null);
  const hello = greeting(name);
  const [confirmClear, setConfirmClear] = useState(false);
  /** Changes each time an answer lands, to replay Wally's hop. */
  const [hops, setHops] = useState(0);
  /** Ticks every few seconds, so his face doesn't hold one expression. */
  const [beat, setBeat] = useState(0);
  /** True for a moment after an answer lands. */
  const [cheer, setCheer] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const busy = pending !== null;
  const empty = messages.length === 0 && !busy;

  useEffect(() => {
    const timer = setInterval(() => setBeat((n) => n + 1), 4200);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!cheer) return;
    const timer = setTimeout(() => setCheer(false), 2400);
    return () => clearTimeout(timer);
  }, [cheer]);

  // Open on the latest message.
  useEffect(() => toBottom(false), []);

  // Messages can arrive from elsewhere (another device, and soon text), so
  // look again whenever the person comes back to this tab.
  const refresh = useCallback(async (): Promise<ChatMessage[] | null> => {
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as { messages: ChatMessage[]; address?: string | null; places?: boolean };
      if (typeof data.places === "boolean") setPlaces(data.places);
      if (data.address !== undefined) setAddress(data.address);
      setMessages((current) => {
        const last = (list: ChatMessage[]) => list[list.length - 1]?.id;
        return current.length === data.messages.length && last(current) === last(data.messages) ? current : data.messages;
      });
      return data.messages;
    } catch {
      return null;
    }
  }, []);
  /** The text of the person's latest stored message, after re-reading the thread. Null if it couldn't be read. */
  const latestUserMessage = useCallback(async () => {
    const list = await refresh();
    return list ? (list.filter((m) => m.role === "user").pop()?.content ?? "") : null;
  }, [refresh]);
  // And once on arrival: a page opened before a change went live should still catch up.
  useEffect(() => {
    const soon = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(soon);
  }, [refresh]);
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible" && !busy) void refresh();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [busy, refresh]);

  // And every few seconds while the page is showing, so a text sent from the phone appears here without a refresh.
  useEffect(() => {
    if (busy) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 6000);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  // Follow the conversation down the page unless the person has scrolled up to read.
  const follow = useRef(true);
  useEffect(() => {
    if (follow.current) toBottom(true);
  }, [messages, pending]);

  const fail = (code: string, text: string) => {
    setPending(null);
    setMood("sorry");
    setError(problems[code] ?? problems.failed!);
    // Give the words back so nothing has to be retyped.
    setDraft((current) => current || text);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy || !ready) return;
    if (text.length > MAX_MESSAGE_CHARS) return setError(problems.invalid_input!);
    setError(null);
    setConfirmClear(false);
    setDraft("");
    follow.current = true;
    setPending({ text, answer: "", searching: false });
    setMood("thinking");

    let res: Response;
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
    } catch {
      return fail("network", text);
    }
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return fail(data.error ?? "failed", text);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let finished = false;
    const handle = (event: ChatEvent) => {
      if (event.type === "text") {
        setMood("speaking");
        follow.current = nearBottom();
        setPending((p) => (p ? { ...p, answer: p.answer + event.text, searching: false } : p));
      } else if (event.type === "searching") {
        setMood("thinking");
        setPending((p) => (p ? { ...p, searching: true } : p));
      } else if (event.type === "done") {
        finished = true;
        const mine: ChatMessage = { id: event.message.id - 1, role: "user", channel: "web", content: text, choices: null, created_at: event.message.created_at };
        setMessages((current) => [...current, mine, event.message]);
        setPending(null);
        setMood("idle");
        setHops((n) => n + 1);
        setCheer(true);
      } else {
        finished = true;
        fail(event.error, text);
      }
    };
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as ChatEvent);
      }
    } catch {
      // The connection dropped mid-answer. The server keeps going and saves the reply,
      // so check what was actually saved before saying the message wasn't sent:
      // handing the words back now would have them sent twice.
      if (!finished) {
        const saved = await latestUserMessage();
        if (saved === text) {
          setPending(null);
          setMood("idle");
        } else fail("network", text);
        return;
      }
    }
    // The connection closed without a verdict: check what was actually saved.
    if (!finished) {
      setPending(null);
      setMood("idle");
      await refresh();
    }
    input.current?.focus();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  const clear = async () => {
    setConfirmClear(false);
    try {
      const res = await fetch("/api/chat", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMessages([]);
      setError(null);
      setMood("idle");
    } catch {
      setError(problems.clear_failed!);
    }
  };

  // Grow the box with the message, up to a few lines.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [draft]);

  const line = !ready
    ? "My line to the kitchen isn’t connected yet."
    : pending?.searching
      ? "One moment. I’m on it."
      : mood === "thinking"
        ? "One moment. Let me think."
      : mood === "sorry"
        ? "My apologies. That didn’t go through."
        : empty
          ? hello
          : mood === "speaking"
            ? "Here’s my thinking."
            : idleLines[messages.length % idleLines.length]!;
  const look: WallyLook = !ready || mood === "sorry" ? "sorry" : mood === "thinking" ? "thinking" : mood === "speaking" ? "talking" : cheer ? "delight" : idleLooks[beat % idleLooks.length]!;
  const lastId = messages[messages.length - 1]?.id;

  return (
    <>
    {places && <LocationBar saved={address} onChange={setAddress} />}
    <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-5 sm:px-8 min-[900px]:flex-row min-[900px]:gap-12">
      {/* Wally: beside the conversation on wide screens, above it on narrow ones.
          This box is its own stacking group, so wherever the full render shows it must carry Wally's blend (see globals.css). */}
      <aside
        className={`z-10 min-[900px]:mix-blend-darken min-[900px]:sticky min-[900px]:flex ${places ? "min-[900px]:top-[7.25rem] min-[900px]:h-[calc(100dvh-11.5rem)]" : "min-[900px]:top-[3.75rem] min-[900px]:h-[calc(100dvh-8rem)]"} min-[900px]:w-[340px] min-[900px]:shrink-0 min-[900px]:flex-col min-[900px]:justify-center min-[900px]:pb-16 ${
          empty ? "pt-4 mix-blend-darken" : `fade-under sticky ${places ? "top-[6.5rem] sm:top-[7.25rem]" : "top-12 sm:top-[3.75rem]"} -mx-5 bg-paper px-5 py-1 sm:-mx-8 sm:px-8 min-[900px]:mx-0 min-[900px]:bg-transparent min-[900px]:px-0 min-[900px]:after:hidden`
        }`}
      >
        <div className={`flex gap-2 min-[900px]:flex-col min-[900px]:gap-0 ${empty ? "items-end" : "items-center"}`}>
          <div className={`order-2 min-w-0 flex-1 min-[900px]:order-1 min-[900px]:flex-none ${empty ? "pb-6 min-[900px]:pb-0" : ""}`}>
            {line && (
              <p
                key={line}
                className={`say fill-ink bg-ink font-semibold text-white min-[900px]:ml-8 min-[900px]:rounded-[1.6rem] min-[900px]:rounded-bl-md min-[900px]:px-6 min-[900px]:py-5 min-[900px]:text-[1.35rem] min-[900px]:leading-snug ${
                  empty
                    ? "rounded-[1.6rem] rounded-bl-md px-5 py-4 text-[1.15rem] leading-snug"
                    : "inline-block rounded-full px-3.5 py-1.5 text-[0.9rem] leading-tight shadow-[0_8px_18px_-12px_rgba(22,26,43,0.7)]"
                }`}
              >
                {line}
              </p>
            )}
          </div>
          {/* Mid-conversation on a phone there is only room for his face, so that is what shows, and it keeps moving. */}
          {!empty && (
            <div className="relative order-1 shrink-0 min-[900px]:hidden">
              <div key={hops} className={hops ? "face-pop" : undefined}>
                <div className={`aura ${mood === "thinking" ? "aura-busy" : ""}`}>
                  <div className={`overflow-hidden rounded-full ${mood === "thinking" ? "face-nod" : ""}`}>
                    <WallyFace look={look} className="block size-11" />
                  </div>
                </div>
              </div>
              {cheer && (
                <>
                  <span className="spark -top-1 -right-1.5" aria-hidden="true">✦</span>
                  <span className="spark -bottom-0.5 -left-1.5" style={{ "--d": "160ms" } as CSSProperties} aria-hidden="true">✦</span>
                </>
              )}
            </div>
          )}
          <div className={`order-1 shrink-0 min-[900px]:order-2 min-[900px]:-mt-1 min-[900px]:w-full ${empty ? "w-[36%]" : "hidden min-[900px]:block"}`}>
            <div className="wally-enter">
              <div key={hops} className={hops ? "wally-hop" : undefined}>
                <div className={mood === "thinking" ? "wally-think" : "wally-float"}>
                  <Wally priority className="w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className={`mx-auto flex w-full max-w-[640px] min-w-0 flex-1 flex-col min-[900px]:mx-0 min-[900px]:pt-6 ${empty ? "min-[900px]:justify-center min-[900px]:pb-16" : ""}`}>
        {/* On a wide, empty page the title introduces the room; otherwise Wally's bubble does. */}
        <div className={empty ? "sr-only min-[900px]:not-sr-only" : "sr-only"}>
          <h1 className="arrive font-display text-5xl font-bold tracking-[-0.025em]">Ask Wally</h1>
          {empty && (
            <p className="arrive mt-3 max-w-[30rem] text-xl text-ink-soft" style={{ "--d": "120ms" } as CSSProperties}>
              Every place worth knowing near you, local favorites first. Dinner ideas, date nights, and how to land the
              table everyone wants.
            </p>
          )}
        </div>

        {messages.length > 0 && (
          <div className="flex min-h-8 items-center justify-end gap-3 pt-1 text-[0.85rem]">
            {confirmClear ? (
              <>
                <span className="text-ink-soft">Erase this whole conversation?</span>
                <button type="button" onClick={() => setConfirmClear(false)} autoFocus className="font-semibold underline-offset-4 hover:underline">
                  Keep it
                </button>
                <button type="button" onClick={clear} className="font-semibold text-red underline-offset-4 hover:underline">
                  Erase
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} disabled={busy} className="font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline disabled:opacity-50">
                Start over
              </button>
            )}
          </div>
        )}

        <div className={`flex flex-1 flex-col justify-end gap-2.5 pt-3 pb-1 ${empty ? "min-[900px]:flex-none min-[900px]:pt-8" : ""}`} role="log" aria-label="Conversation with Wally">
          {empty && ready && (
            <ul className="grid gap-2.5 sm:grid-cols-2" aria-label="Things to ask Wally">
              {starters.map((s, i) => (
                <li key={s.label} className="arrive" style={{ "--d": `${350 + i * 110}ms` } as CSSProperties}>
                  <button
                    type="button"
                    onClick={() => void send(s.label)}
                    className="press card flex h-full w-full items-center gap-3 rounded-2xl bg-pad p-2.5 text-left font-semibold ring-1 ring-line transition-shadow ring-inset hover:ring-2 hover:ring-green"
                  >
                    <Tile>{s.emoji}</Tile>
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} text={m.content} byText={m.channel === "text"} />
            ) : (
              <WallyTurn key={m.id} text={m.content} at={m.created_at} byText={m.channel === "text"} choices={m.choices} live={m.id === lastId && !busy && ready} onPick={(c) => void send(c.reply)} onMore={() => void send("Show me 4 more")} />
            ),
          )}

          {pending && (
            <>
              <UserBubble text={pending.text} fresh />
              {pending.answer && <WallyTurn text={pending.answer} writing={!pending.searching} />}
              {(!pending.answer || pending.searching) && (
                <div
                  className="say card flex w-fit items-center gap-1.5 rounded-[1.35rem] rounded-bl-md bg-pad px-4 py-3.5 ring-1 ring-line ring-inset"
                  aria-label={pending.searching ? "Wally is looking something up" : "Wally is thinking"}
                >
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="dot size-2 rounded-full bg-[linear-gradient(135deg,var(--mint),var(--green))]" style={{ "--d": `${d}ms` } as CSSProperties} />
                  ))}
                  {pending.searching && <LookingUp />}
                </div>
              )}
            </>
          )}
        </div>

        <div className="dock sticky bottom-0 -mx-5 px-5 pt-3 pb-2.5 sm:-mx-8 sm:px-8 min-[900px]:mx-0 min-[900px]:px-0 min-[900px]:pb-4">
          {error && (
            <p role="alert" className="mb-2 rounded-xl border border-red/40 bg-red/5 p-3 text-[0.95rem] font-medium text-red">
              {error}
            </p>
          )}
          <form onSubmit={submit} className="composer flex items-end gap-2 rounded-[1.6rem] p-1">
            <label htmlFor="ask" className="sr-only">
              Message Wally
            </label>
            <textarea
              id="ask"
              ref={input}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={!ready}
              maxLength={MAX_MESSAGE_CHARS}
              enterKeyHint="send"
              placeholder={ready ? "Tell Wally what you’re hungry for" : "Wally isn’t switched on yet"}
              className="min-h-11 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-[1.0625rem] placeholder:text-ink-soft outline-none! disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!draft.trim() || busy || !ready}
              aria-label="Send"
              className="press fill-green flex size-11 shrink-0 items-center justify-center rounded-full bg-green text-white hover:brightness-110 disabled:bg-line disabled:text-ink-soft"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5.5 11.5 12 5l6.5 6.500" />
              </svg>
            </button>
          </form>
          <p className="mt-1.5 text-center text-[0.72rem] leading-snug text-ink-soft min-[900px]:mt-2 min-[900px]:text-[0.85rem]">
            Wally is an AI. You pay restaurants on their own pages; he can’t book tables yet. Confirm hours and prices with the restaurant.
          </p>
        </div>

        {/* Screen readers hear each finished answer once, not every streamed word. */}
        <p className="sr-only" aria-live="polite">
          {messages[messages.length - 1]?.role === "assistant" ? `Wally: ${splitSources(messages[messages.length - 1]!.content).text}` : ""}
        </p>
      </section>
    </main>
    </>
  );
}

/**
 * An order ready to pay, laid out like a restaurant check. Every figure is the
 * restaurant's own; the person pays on its checkout page, never here.
 */
function Ticket({ ticket: t, live }: { ticket: TicketInfo; live: boolean }) {
  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-3 ${strong ? "font-bold" : "text-ink-soft"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className={`card mt-2 max-w-[22rem] overflow-hidden rounded-2xl bg-pad ring-1 ring-line ring-inset ${live ? "arrive" : "opacity-80"}`}>
      <div className="px-4 pt-3.5 pb-3">
        <p className="text-[0.75rem] font-semibold tracking-[0.12em] text-ink-soft uppercase">Pickup order</p>
        <p className="mt-0.5 font-display text-[1.15rem] leading-tight font-bold">{t.restaurant}</p>
        {t.address && <p className="text-[0.85rem] text-ink-soft">{t.address}</p>}
      </div>
      <div className="mx-4 border-t border-dashed border-line" />
      <div className="space-y-1 px-4 py-3 text-[0.95rem]">
        <div className="flex justify-between gap-3">
          <span className="min-w-0">
            <span className="font-semibold">
              {t.quantity} × {t.item}
              {t.variation && t.variation !== "Regular" ? ` (${t.variation})` : ""}
            </span>
            {t.modifiers.length > 0 && <span className="block text-[0.85rem] leading-snug text-ink-soft">{t.modifiers.join(", ")}</span>}
          </span>
          <span className="tabular-nums">{dollars(t.subtotal)}</span>
        </div>
      </div>
      <div className="mx-4 border-t border-dashed border-line" />
      <div className="space-y-1 px-4 py-3 text-[0.95rem]">
        {row("Subtotal", dollars(t.subtotal))}
        {row("Tax", dollars(t.tax))}
        {row("Total", dollars(t.total), true)}
      </div>
      <div className="px-4 pb-4">
        <a
          href={t.checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`press fill-green flex h-11 items-center justify-center rounded-xl bg-green font-semibold text-white hover:brightness-110 ${live ? "" : "pointer-events-none opacity-60"}`}
        >
          Pay {dollars(t.total)} on the restaurant’s page
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <p className="mt-2 text-center text-[0.78rem] leading-snug text-ink-soft">Nothing is charged until you pay there. Wally never sees your card.</p>
      </div>
    </div>
  );
}

/** Open or closed, rating and price: the facts about a place, from the listing, on one line. */
function PlaceFacts({ place, fresh }: { place: NonNullable<Choice["place"]>; fresh: boolean }) {
  const open = fresh ? place.open : undefined;
  if (open === undefined && place.rating === undefined && !place.price) return null;
  return (
    <span className="flex items-center gap-2 text-[0.8rem] leading-[1.15rem] font-semibold text-ink-soft">
      {open !== undefined && (
        <span className={`inline-flex items-center gap-1 ${open ? "text-green-deep" : ""}`}>
          <span className={`size-1.5 rounded-full ${open ? "bg-mint shadow-[0_0_0_3px_rgba(60,194,143,0.22)]" : "bg-ink-soft/50"}`} aria-hidden="true" />
          {open ? "Open" : "Closed"}
        </span>
      )}
      {place.rating !== undefined && (
        <span className="tabular-nums">
          <span className="text-[#e0a100]" aria-hidden="true">★ </span>
          {place.rating.toFixed(1)}
          <span className="sr-only"> stars</span>
        </span>
      )}
      {place.price && <span>{place.price}</span>}
    </span>
  );
}

/** The chips under a place card: the one that leads glows, the rest sit plain. */
const CHIP = {
  lead: "chip-lead ring-1 ring-mint/50 ring-inset hover:ring-green",
  plain: "bg-paper ring-1 ring-line ring-inset hover:bg-mint-wash hover:ring-mint/60",
};

/**
 * The mark after a place's name when Wally can build the order there: a
 * scalloped seal in vest navy, so it reads as a credential and not as one
 * more green chip.
 */
function OrderCheck() {
  return (
    <span className="ml-1.5 inline-flex align-[-0.18em] text-ink" title="Wally can build your pickup order here">
      <svg viewBox="0 0 20 20" className="size-[1.05rem]" aria-hidden="true">
        <path
          d="M10 1.2l1.9 1.5 2.4-.4.9 2.3 2.2 1-.4 2.4 1.5 1.9-1.5 1.9.4 2.4-2.2 1-.9 2.3-2.4-.4L10 18.8l-1.9-1.5-2.4.4-.9-2.3-2.2-1 .4-2.4L1.5 10 3 8.1l-.4-2.4 2.2-1 .9-2.3 2.4.4z"
          fill="currentColor"
        />
        <path d="M6.3 10.3l2.5 2.5 5-5.2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only"> (Order with Wally)</span>
    </span>
  );
}

/** What Wally says he's up to while he looks something up. */
const lookingUp = ["Checking my notepad", "Asking around the kitchen", "Cooking up a good answer"];

function LookingUp() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((n) => (n + 1) % lookingUp.length), 2400);
    return () => clearInterval(timer);
  }, []);
  return (
    <span key={step} className="say shimmer ml-2 text-[0.95rem] leading-tight font-medium">
      {lookingUp[step]}
    </span>
  );
}

function Tile({ children }: { children: string }) {
  return (
    <span className="tile flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-wash text-[1.3rem]" aria-hidden="true">
      {children}
    </span>
  );
}

function ByText() {
  return <span className="mt-1 block text-[0.8rem] opacity-70">sent by text</span>;
}

function UserBubble({ text, byText = false, fresh = false }: { text: string; byText?: boolean; fresh?: boolean }) {
  return (
    <p className={`ml-auto max-w-[85%] rounded-[1.35rem] rounded-br-md fill-green bg-green px-4 py-2 break-words whitespace-pre-wrap text-white ${fresh ? "sent-mine" : ""}`}>
      <span className="sr-only">You: </span>
      {text}
      {byText && <ByText />}
    </p>
  );
}

function WallyTurn({
  text,
  at,
  choices = null,
  byText = false,
  writing = false,
  live = false,
  onPick,
  onMore,
}: {
  text: string;
  /** When Wally said it. */
  at?: string;
  choices?: Choice[] | null;
  byText?: boolean;
  writing?: boolean;
  /** Only the latest answer's options can still be picked. */
  live?: boolean;
  onPick?: (choice: Choice) => void;
  /** Asks Wally for the next four places. */
  onMore?: () => void;
}) {
  // Sources ride along in the text (see splitSources); here they become links.
  const { text: said, sources } = splitSources(text);
  // "Open" was true when he answered; it isn't worth showing on an old message.
  // It depends on the visitor's clock, so the server renders without it.
  const fresh = useSyncExternalStore(
    noSubscription,
    () => at !== undefined && Date.now() - Date.parse(at) < OPEN_BADGE_MINUTES * 60_000,
    () => false,
  );
  const places = choices?.some((c) => c.place) ?? false;
  return (
    <div>
      {said && (
        <p className="card w-fit max-w-[92%] rounded-[1.35rem] rounded-bl-md bg-pad px-4 py-2.5 break-words whitespace-pre-wrap ring-1 ring-line ring-inset">
          <span className="sr-only">Wally: </span>
          {said}
          {writing && <span className="caret" aria-hidden="true" />}
          {byText && <ByText />}
        </p>
      )}
      {choices?.some((c) => c.ticket) && choices.map((c, i) => c.ticket && <Ticket key={i} ticket={c.ticket} live={live} />)}
      {choices && !choices.some((c) => c.ticket) && (
        <ul className={`mt-2 grid gap-1.5 ${places ? "" : "sm:grid-cols-2"}`}>
          {choices.map((c, i) => (
            <li
              key={`${i}-${c.title}`}
              className={`card flex flex-col overflow-hidden rounded-2xl bg-pad ring-1 ring-line transition-shadow ring-inset ${live ? "arrive hover:ring-2 hover:ring-green" : "opacity-70"}`}
              style={{ "--d": `${i * 70}ms` } as CSSProperties}
            >
              <button type="button" disabled={!live} onClick={() => onPick?.(c)} className={`press flex w-full flex-1 items-start gap-2.5 px-2.5 text-left ${c.place ? "pt-2 pb-1.5" : "py-2.5"}`}>
                <Tile>{c.emoji}</Tile>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="line-clamp-2 min-w-0 flex-1 leading-[1.3] font-semibold">
                      {c.title}
                      {c.place?.orders && <OrderCheck />}
                    </span>
                    {c.place?.miles !== undefined && (
                      <span className="shrink-0 text-[0.8rem] font-semibold text-ink-soft tabular-nums">
                        {c.place.miles} mi<span className="sr-only"> away</span>
                      </span>
                    )}
                  </span>
                  {c.place && <PlaceFacts place={c.place} fresh={fresh} />}
                  {c.detail && <span className={`block text-[0.875rem] leading-[1.3] text-ink-soft ${c.place ? "line-clamp-2" : "mt-0.5"}`}>{c.detail}</span>}
                </span>
              </button>
              {c.place && (
                <p className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2 text-[0.8rem] font-semibold text-green-deep">
                  {/* Ordering here leads when Wally can build the order; otherwise the restaurant's own site does. */}
                  {c.place.orders && (
                    <button type="button" disabled={!live} onClick={() => onPick?.({ ...c, reply: `Order from ${c.title}` })} className={`press inline-flex h-7 items-center rounded-full px-2.5 transition-colors ${CHIP.lead}`}>
                      Order with Wally<span className="sr-only"> from {c.title}</span>
                    </button>
                  )}
                  {[
                    ...(c.place.website ? [{ label: "Website", url: c.place.website, lead: !c.place.orders && isOwnSite(c.place.website) }] : []),
                    ...deliveryLinks(c.title, c.place.website).map((d) => ({ label: d.app, url: d.url, lead: false })),
                    { label: "Map", url: c.place.maps, lead: false },
                  ].map((link) => (
                    <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className={`inline-flex h-7 items-center rounded-full px-2.5 transition-colors ${link.lead ? CHIP.lead : CHIP.plain}`}>
                      {link.label}
                      <span className="sr-only"> for {c.title} (opens in a new tab)</span>
                    </a>
                  ))}
                </p>
              )}
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-[0.88rem] font-semibold text-green hover:bg-mint-wash"
                >
                  <span className="truncate">{hostOf(c.url)}</span>
                  <span aria-hidden="true">↗</span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {places && (
        // Google's attribution rules for Places data shown without a map: the words "Google Maps", untranslated.
        <div className="mt-1 flex min-h-7 items-center justify-between gap-3">
          <p className="text-[0.8125rem] leading-tight whitespace-nowrap" style={{ fontFamily: "Roboto, sans-serif", fontWeight: 400, color: "#5E5E5E" }}>
            <span translate="no">Google Maps</span>
          </p>
          {live && onMore && (
            <button type="button" onClick={onMore} className="press chip-lead inline-flex h-7 items-center gap-1 rounded-full px-3 text-[0.8rem] font-semibold text-green-deep ring-1 ring-mint/50 ring-inset hover:ring-green">
              See 4 more
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
      )}
      {sources.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[0.85rem] text-ink-soft">
          <span>From the web:</span>
          {sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              title={source.title}
              className="inline-flex h-7 max-w-[14rem] items-center rounded-full bg-pad px-2.5 font-semibold text-green ring-1 ring-line ring-inset hover:ring-green"
            >
              <span className="truncate">{hostOf(source.url)}</span>
              <span className="sr-only">: {source.title} (opens in a new tab)</span>
            </a>
          ))}
        </p>
      )}
    </div>
  );
}
