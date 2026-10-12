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

/** The address Wally searches near. Sits above the conversation, outside it. */
export function LocationBar({ initial }: { initial: string | null }) {
  const [saved, setSaved] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setSaved(data.address ?? null);
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

  const quiet = "press h-9 shrink-0 rounded-full px-3 text-[0.9rem] font-semibold text-ink-soft hover:text-ink disabled:opacity-50";

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pt-3 sm:px-8">
      <div className="flex min-h-11 items-center gap-2 rounded-full bg-pad py-1 pr-1.5 pl-3 ring-1 ring-line ring-inset">
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-green" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-7-6.200-7-11.500a7 7 0 0 1 14 0C19 14.800 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        {saved && !editing ? (
          <>
            <p className="min-w-0 flex-1 truncate text-[0.95rem]">
              <span className="text-ink-soft">Near </span>
              <span className="font-semibold">{tidy(saved)}</span>
            </p>
            <button
              type="button"
              className={quiet}
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
            <label htmlFor="address" className="sr-only">
              Your address
            </label>
            <input
              id="address"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="street-address"
              autoFocus={editing}
              maxLength={200}
              placeholder="Add your address so Wally can find what’s close"
              className="h-9 min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none! placeholder:text-ink-soft"
            />
            {editing && saved && (
              <>
                <button type="button" className={`${quiet} hidden sm:block`} disabled={busy} onClick={() => void request("DELETE")}>
                  Remove
                </button>
                <button type="button" className={quiet} disabled={busy} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </>
            )}
            <button type="submit" disabled={busy || !draft.trim()} className="press h-9 shrink-0 rounded-full bg-ink px-4 text-[0.9rem] font-semibold text-white disabled:bg-line disabled:text-ink-soft">
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
  );
}
