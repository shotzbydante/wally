"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { LocationBar } from "@/components/LocationBar";
import { Wally } from "@/components/Wally";
import { MAX_MESSAGE_CHARS, OPEN_BADGE_MINUTES, deliveryLinks, hostOf, splitSources, type ChatEvent, type ChatMessage, type Choice } from "@/lib/chat";

/** What Wally is doing, which drives how he moves and what his bubble says. */
type Mood = "idle" | "thinking" | "speaking" | "sorry";

const starters = [
  { emoji: "🍜", label: "Help me pick dinner tonight" },
  { emoji: "🕯️", label: "Plan a date night" },
  { emoji: "🌶️", label: "Something spicy, under $25" },
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

function greeting(name: string): string {
  const hour = new Date().getHours();
  const part = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${part}${name ? `, ${name}` : ""}. I’m Wally. What are we eating?`;
}

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
  // The greeting depends on the visitor's clock, so the server renders none
  // and the browser fills it in.
  const hello = useSyncExternalStore(noSubscription, () => greeting(name), () => null);
  const [confirmClear, setConfirmClear] = useState(false);
  /** Changes each time an answer lands, to replay Wally's hop. */
  const [hops, setHops] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const busy = pending !== null;
  const empty = messages.length === 0 && !busy;

  // Open on the latest message.
  useEffect(() => toBottom(false), []);

  // Messages can arrive from elsewhere (another device, and soon text), so
  // look again whenever the person comes back to this tab.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[]; address?: string | null; places?: boolean };
      if (typeof data.places === "boolean") setPlaces(data.places);
      if (data.address !== undefined) setAddress(data.address);
      setMessages((current) => {
        const last = (list: ChatMessage[]) => list[list.length - 1]?.id;
        return current.length === data.messages.length && last(current) === last(data.messages) ? current : data.messages;
      });
    } catch {}
  }, []);
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
      if (!finished) return fail("network", text);
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
            : "At your service.";
  const lastId = messages[messages.length - 1]?.id;

  return (
    <>
    {places && <LocationBar saved={address} onChange={setAddress} />}
    <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-5 sm:px-8 min-[900px]:flex-row min-[900px]:gap-12">
      {/* Wally: beside the conversation on wide screens, above it on narrow ones.
          A sticky box is its own stacking group, so on wide screens it must carry Wally's blend (see globals.css). */}
      <aside
        className={`z-10 min-[900px]:mix-blend-darken min-[900px]:sticky min-[900px]:flex ${places ? "min-[900px]:top-[4.5rem] min-[900px]:h-[calc(100dvh-8.75rem)]" : "min-[900px]:top-0 min-[900px]:h-[calc(100dvh-4.25rem)]"} min-[900px]:w-[340px] min-[900px]:shrink-0 min-[900px]:flex-col min-[900px]:justify-center min-[900px]:pb-16 ${
          empty ? "pt-4" : `sticky ${places ? "top-[4.5rem]" : "top-0"} -mx-5 bg-paper/90 px-5 py-2 backdrop-blur sm:-mx-8 sm:px-8 min-[900px]:mx-0 min-[900px]:bg-transparent min-[900px]:px-0 min-[900px]:backdrop-blur-none`
        }`}
      >
        <div className={`flex gap-2 min-[900px]:flex-col min-[900px]:gap-0 ${empty ? "items-end" : "items-center"}`}>
          <div className={`order-2 min-w-0 flex-1 min-[900px]:order-1 min-[900px]:flex-none ${empty ? "pb-6 min-[900px]:pb-0" : ""}`}>
            {line && (
              <p
                key={line}
                className={`say bg-ink font-semibold text-white min-[900px]:ml-8 min-[900px]:rounded-[1.6rem] min-[900px]:rounded-bl-md min-[900px]:px-6 min-[900px]:py-5 min-[900px]:text-[1.35rem] min-[900px]:leading-snug ${
                  empty
                    ? "rounded-[1.6rem] rounded-bl-md px-5 py-4 text-[1.15rem] leading-snug"
                    : "inline-block rounded-full px-4 py-1.5 text-[0.95rem]"
                }`}
              >
                {line}
              </p>
            )}
          </div>
          <div className={`order-1 shrink-0 min-[900px]:order-2 min-[900px]:-mt-1 min-[900px]:w-full ${empty ? "w-[36%]" : "w-14"}`}>
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
              Dinner ideas, date nights, group plans, and how to land the table everyone wants.
            </p>
          )}
        </div>

        {messages.length > 0 && (
          <div className="flex min-h-9 items-center justify-end gap-3 pt-2 text-[0.9rem]">
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

        <div className={`flex flex-1 flex-col justify-end gap-3 py-4 ${empty ? "min-[900px]:flex-none min-[900px]:pt-8" : ""}`} role="log" aria-label="Conversation with Wally">
          {empty && ready && (
            <ul className="grid gap-2.5 sm:grid-cols-2" aria-label="Things to ask Wally">
              {starters.map((s, i) => (
                <li key={s.label} className="arrive" style={{ "--d": `${350 + i * 110}ms` } as CSSProperties}>
                  <button
                    type="button"
                    onClick={() => void send(s.label)}
                    className="press flex h-full w-full items-center gap-3 rounded-2xl bg-pad p-3 text-left font-semibold ring-1 ring-line transition-shadow ring-inset hover:ring-2 hover:ring-green"
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
              <WallyTurn key={m.id} text={m.content} at={m.created_at} byText={m.channel === "text"} choices={m.choices} live={m.id === lastId && !busy && ready} onPick={(c) => void send(c.reply)} />
            ),
          )}

          {pending && (
            <>
              <UserBubble text={pending.text} fresh />
              {pending.answer && <WallyTurn text={pending.answer} writing={!pending.searching} />}
              {(!pending.answer || pending.searching) && (
                <div
                  className="say flex w-fit items-center gap-1.5 rounded-[1.35rem] rounded-bl-md bg-pad px-4 py-4 ring-1 ring-line ring-inset"
                  aria-label={pending.searching ? "Wally is looking something up" : "Wally is thinking"}
                >
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="dot size-2 rounded-full bg-green" style={{ "--d": `${d}ms` } as CSSProperties} />
                  ))}
                  {pending.searching && <LookingUp />}
                </div>
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 -mx-5 bg-paper/90 px-5 pt-2 pb-4 backdrop-blur sm:-mx-8 sm:px-8 min-[900px]:mx-0 min-[900px]:px-0">
          {error && (
            <p role="alert" className="mb-2 rounded-xl border border-red/40 bg-red/5 p-3 text-[0.95rem] font-medium text-red">
              {error}
            </p>
          )}
          <form onSubmit={submit} className="flex items-end gap-2 rounded-[1.6rem] bg-pad p-2 shadow-[0_18px_40px_-22px_rgba(22,26,43,0.35)] ring-2 ring-line transition-shadow ring-inset focus-within:ring-green">
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
              className="min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[1.0625rem] placeholder:text-ink-soft outline-none! disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!draft.trim() || busy || !ready}
              aria-label="Send"
              className="press flex size-11 shrink-0 items-center justify-center rounded-full bg-green text-white hover:bg-green-deep disabled:bg-line disabled:text-ink-soft"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5.5 11.5 12 5l6.5 6.500" />
              </svg>
            </button>
          </form>
          <p className="mt-2 text-center text-[0.85rem] text-ink-soft">
            Wally is an AI. He can’t place orders or book tables yet. Confirm hours and prices with the restaurant.
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

/** Open or closed, distance, rating and price: the facts about a place, from the listing. */
function PlaceFacts({ place, fresh }: { place: NonNullable<Choice["place"]>; fresh: boolean }) {
  const pill = "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[0.8rem] font-semibold";
  return (
    <span className="mt-1 mb-1 flex flex-wrap items-center gap-1.5">
      {fresh && place.open !== undefined && (
        <span className={`${pill} ${place.open ? "bg-mint-wash text-green-deep" : "bg-line/70 text-ink-soft"}`}>{place.open ? "Open" : "Closed"}</span>
      )}
      {place.miles !== undefined && (
        <span className={`${pill} bg-line/50 text-ink`}>
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21s-7-6.200-7-11.500a7 7 0 0 1 14 0C19 14.800 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          {place.miles} mi<span className="sr-only"> away</span>
        </span>
      )}
      {place.rating !== undefined && (
        <span className="text-[0.85rem] font-semibold text-ink-soft">
          <span aria-hidden="true">★ </span>
          {place.rating.toFixed(1)}
          <span className="sr-only"> stars</span>
        </span>
      )}
      {place.price && <span className="text-[0.85rem] font-semibold text-ink-soft">{place.price}</span>}
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
    <span key={step} className="say ml-2 text-[0.95rem] leading-none text-ink-soft">
      {lookingUp[step]}
    </span>
  );
}

function Tile({ children }: { children: string }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-wash text-[1.4rem]" aria-hidden="true">
      {children}
    </span>
  );
}

function ByText() {
  return <span className="mt-1 block text-[0.8rem] opacity-70">sent by text</span>;
}

function UserBubble({ text, byText = false, fresh = false }: { text: string; byText?: boolean; fresh?: boolean }) {
  return (
    <p className={`ml-auto max-w-[85%] rounded-[1.35rem] rounded-br-md bg-green px-4 py-2.5 break-words whitespace-pre-wrap text-white ${fresh ? "sent-mine" : ""}`}>
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
    <div className="max-w-[92%]">
      {said && (
        <p className="w-fit rounded-[1.35rem] rounded-bl-md bg-pad px-4 py-3 break-words whitespace-pre-wrap ring-1 ring-line ring-inset">
          <span className="sr-only">Wally: </span>
          {said}
          {writing && <span className="caret" aria-hidden="true" />}
          {byText && <ByText />}
        </p>
      )}
      {choices && (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {choices.map((c, i) => (
            <li
              key={`${i}-${c.title}`}
              className={`flex flex-col overflow-hidden rounded-2xl bg-pad ring-1 ring-line transition-shadow ring-inset ${live ? "arrive hover:ring-2 hover:ring-green" : "opacity-70"}`}
              style={{ "--d": `${i * 90}ms` } as CSSProperties}
            >
              <button type="button" disabled={!live} onClick={() => onPick?.(c)} className="press flex w-full flex-1 items-start gap-3 p-3 text-left">
                <Tile>{c.emoji}</Tile>
                <span className="min-w-0">
                  <span className="block leading-snug font-semibold">{c.title}</span>
                  {c.place && <PlaceFacts place={c.place} fresh={fresh} />}
                  {c.detail && <span className="mt-0.5 block text-[0.92rem] leading-snug text-ink-soft">{c.detail}</span>}
                </span>
              </button>
              {c.place && (
                <p className="flex flex-wrap gap-x-3.5 gap-y-1 border-t border-line px-3 py-2 text-[0.88rem] font-semibold text-green">
                  {[
                    ...(c.place.website ? [{ label: "Website", url: c.place.website }] : []),
                    ...deliveryLinks(c.title).map((d) => ({ label: d.app, url: d.url })),
                    { label: "Map", url: c.place.maps },
                  ].map((link) => (
                    <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
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
        <p className="mt-1.5 text-[0.8125rem] whitespace-nowrap" style={{ fontFamily: "Roboto, sans-serif", fontWeight: 400, color: "#5E5E5E" }}>
          <span translate="no">Google Maps</span>
        </p>
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
