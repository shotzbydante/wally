"use client";

import { useState, type FormEvent } from "react";

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
        setEditing(false);
        setDraft("");
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
      <div className="mx-auto w-full max-w-[1080px] px-5 py-2 sm:px-8">
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
                  setDraft(tidy(saved));
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
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="street-address"
                autoFocus={editing}
                maxLength={200}
                aria-label="Your address"
                placeholder="Your address, so Wally can find what’s close"
                className="h-8 min-w-0 flex-1 bg-transparent px-1 outline-none! placeholder:text-ink-soft sm:px-2"
              />
              {saved && (
                <>
                  <button type="button" className={`${quiet} hidden sm:block`} disabled={busy} onClick={() => void request("DELETE")}>
                    Remove
                  </button>
                  <button type="button" className={quiet} disabled={busy} onClick={() => setEditing(false)}>
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
        {error && (
          <p role="alert" className="mt-2 px-3 text-[0.9rem] font-medium text-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
