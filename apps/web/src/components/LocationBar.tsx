"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

interface Suggestion {
  text: string;
  main: string;
  secondary: string;
}

const problems: Record<string, string> = {
  not_found: "Wally couldn’t find that address. Check it and try again.",
  lookup_failed: "The address lookup didn’t respond. Your address wasn’t saved. Try again in a moment.",
  not_configured: "Address lookup isn’t switched on yet, so your address wasn’t saved.",
  unavailable: "Wally’s records didn’t respond. Your address wasn’t changed. Try again in a moment.",
  signed_out: "You’ve been signed out. Sign in again to save your address.",
  invalid_input: "Enter a street address, like 123 Main St, Los Angeles.",
  network: "Couldn’t reach Wally. Check your connection and try again.",
};

/** "5905 Wilshire Blvd, Los Angeles, CA 90036, USA" reads better without the country. */
const tidy = (address: string) => address.replace(/,\s*(USA|United States)$/i, "");

function Pin({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.200-7-11.500a7 7 0 0 1 14 0C19 14.800 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

/**
 * The address Wally searches near. It stays pinned to the top of the page
 * while the conversation scrolls, so it can be changed at any point.
 * AskWally's sticky offsets assume this bar is 3.5rem tall.
 */
export function LocationBar({ saved, onChange }: { saved: string | null; onChange: (address: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const asking = !saved || editing;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const field = useRef<HTMLInputElement>(null);
  /** One id per stretch of typing, which Google uses to group the lookups. */
  const typing = useRef("");

  // Suggest addresses a moment after the person stops typing.
  useEffect(() => {
    const typed = draft.trim();
    if (!asking || typed.length < 3) return;
    const stop = new AbortController();
    const timer = setTimeout(async () => {
      typing.current ||= crypto.randomUUID();
      try {
        const res = await fetch(`/api/account/address/suggest?q=${encodeURIComponent(typed)}&session=${typing.current}`, { signal: stop.signal, cache: "no-store" });
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        setSuggestions(res.ok ? (data.suggestions ?? []) : []);
      } catch {}
    }, 220);
    return () => {
      clearTimeout(timer);
      stop.abort();
    };
  }, [draft, asking]);

  const type = (value: string) => {
    setDraft(value);
    if (value.trim().length < 3) setSuggestions([]);
  };
  const close = () => {
    setEditing(false);
    setDraft("");
    setSuggestions([]);
    typing.current = "";
  };

  const request = async (method: "POST" | "DELETE", address?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/address", {
        method,
        ...(address ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as { address?: string; error?: string };
      if (!res.ok) setError(problems[data.error ?? ""] ?? problems.unavailable!);
      else {
        onChange(data.address ?? null);
        close();
      }
    } catch {
      setError(problems.network!);
    }
    setBusy(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim().length < 3) return setError(problems.invalid_input!);
    void request("POST", draft);
  };

  const quiet = "press h-8 shrink-0 rounded-full px-3 text-[0.9rem] font-semibold text-ink-soft hover:text-ink disabled:opacity-50";

  return (
    <div className="sticky top-0 z-20 bg-paper/95 backdrop-blur">
      <div className="relative mx-auto w-full max-w-[1080px] px-5 py-2 sm:px-8">
        {/* With no address yet the bar is tinted and outlined, so it reads as the next thing to do. */}
        <div
          className={`flex h-10 items-center gap-2 rounded-full py-1 pr-1 pl-1 text-[0.95rem] ring-inset ${
            saved && !editing ? "bg-pad shadow-[0_6px_18px_-14px_rgba(22,26,43,0.45)] ring-1 ring-line" : "bg-mint-wash ring-2 ring-green"
          }`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full fill-green text-white">
            <Pin className="size-[1.1rem]" />
          </span>
          {!asking ? (
            <>
              <p className="min-w-0 flex-1 truncate">
                <span className="text-ink-soft">Near </span>
                <span className="font-semibold">{tidy(saved)}</span>
              </p>
              <button
                type="button"
                className="press h-8 shrink-0 rounded-full bg-paper px-3.5 text-[0.85rem] font-semibold ring-1 ring-line ring-inset hover:ring-ink"
                onClick={() => {
                  // Start from an empty box: a new address is typed, not edited out of the old one.
                  setDraft("");
                  setSuggestions([]);
                  setError(null);
                  setEditing(true);
                }}
              >
                Change
              </button>
            </>
          ) : (
            <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-1">
              <label htmlFor="address" className="hidden shrink-0 font-semibold text-green-deep sm:block">
                {saved ? "New address" : "Where are you?"}
              </label>
              <input
                id="address"
                ref={field}
                value={draft}
                onChange={(e) => type(e.target.value)}
                autoComplete="street-address"
                autoFocus={editing}
                maxLength={200}
                aria-label="Your address"
                placeholder={saved ? "Type your new address" : "Your address, so Wally can find what’s close"}
                // 16px, or iOS zooms the whole page in when the box is tapped.
                className="h-8 min-w-0 flex-1 bg-transparent px-1 text-[16px] outline-none! placeholder:text-ink-soft sm:px-2"
              />
              {draft && (
                <button
                  type="button"
                  aria-label="Clear the address"
                  className="press flex size-8 shrink-0 items-center justify-center rounded-full text-ink-soft hover:text-ink"
                  onClick={() => {
                    type("");
                    field.current?.focus();
                  }}
                >
                  <svg viewBox="0 0 24 24" className="size-[1.15rem]" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.22" />
                    <path d="m8.5 8.5 7 7m0-7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              {saved && (
                <>
                  <button type="button" className={`${quiet} hidden sm:block`} disabled={busy} onClick={() => void request("DELETE")}>
                    Remove
                  </button>
                  <button type="button" className={quiet} disabled={busy} onClick={close}>
                    Cancel
                  </button>
                </>
              )}
              <button type="submit" disabled={busy || !draft.trim()} className="press fill-green h-8 shrink-0 rounded-full px-4 text-[0.85rem] font-semibold text-white disabled:opacity-60">
                {busy ? "Saving…" : "Save"}
              </button>
            </form>
          )}
        </div>
        {asking && suggestions.length > 0 && (
          <div className="card absolute inset-x-5 top-full z-30 -mt-0.5 overflow-hidden rounded-2xl bg-pad ring-1 ring-line sm:inset-x-8">
            <ul aria-label="Suggested addresses">
              {suggestions.map((s) => (
                <li key={s.text} className="border-b border-line/70 last:border-b-0">
                  <button
                    type="button"
                    disabled={busy}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-mint-wash/60 active:bg-mint-wash disabled:opacity-60"
                    onClick={() => {
                      setDraft(s.text);
                      setSuggestions([]);
                      void request("POST", s.text);
                    }}
                  >
                    <span className="tile flex size-8 shrink-0 items-center justify-center rounded-full bg-mint-wash text-green-deep">
                      <Pin className="size-4" />
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate font-semibold">{s.main}</span>
                      {s.secondary && <span className="block truncate text-[0.85rem] text-ink-soft">{s.secondary}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {/* Google's attribution for suggestions shown without a map. */}
            <p className="px-3 py-1.5 text-right text-[0.75rem]" style={{ fontFamily: "Roboto, sans-serif", color: "#5E5E5E" }}>
              <span translate="no">Google Maps</span>
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 px-3 text-[0.9rem] font-medium text-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
