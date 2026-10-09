"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function NameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== saved && name.trim() !== "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => ({}))) as { name?: string };
      if (res.ok && data.name) {
        setName(data.name);
        setSaved(data.name);
        router.refresh();
      } else setError(res.status === 401 ? "You’ve been signed out. Sign in again to save." : "Use letters only, up to 60 characters.");
    } catch {
      setError("Couldn’t reach Wally. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="py-4">
      <div className="flex gap-3">
        <label htmlFor="display-name" className="sr-only">
          Name
        </label>
        <input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          placeholder="Your first name"
          className="h-12 min-w-0 flex-1 rounded-xl border-2 border-line bg-pad px-4 font-medium transition-colors focus:border-green focus:outline-none"
        />
        <button
          type="submit"
          disabled={!dirty || busy}
          className="press h-12 shrink-0 rounded-xl bg-ink px-5 font-semibold text-white disabled:bg-transparent disabled:text-ink-soft disabled:ring-1 disabled:ring-line disabled:ring-inset"
        >
          {busy ? "Saving…" : dirty ? "Save" : "Saved"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[0.95rem] font-medium text-red">
          {error}
        </p>
      )}
    </form>
  );
}
