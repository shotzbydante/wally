"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

const problems: Record<string, string> = {
  google_not_configured: "Google sign-in isn’t switched on yet.",
  google_failed: "Google sign-in didn’t complete. Try again.",
  link_expired: "That sign-in link has expired or isn’t valid. Send a new one.",
  not_configured: "Email sign-in isn’t switched on yet, so no link was sent.",
  invalid_email: "Enter a valid email address.",
  provider_error: "The email service didn’t respond. Try again in a moment.",
  network: "Couldn’t reach Wally. Check your connection and try again.",
};

export function SignInForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(problems[params.get("error") ?? ""] ?? null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; devLink?: string };
      if (!res.ok) setError(problems[data.error ?? ""] ?? problems.provider_error!);
      else {
        setSentTo(email.trim());
        setDevLink(data.devLink ?? null);
      }
    } catch {
      setError(problems.network!);
    }
    setBusy(false);
  };

  if (sentTo) {
    return (
      <div className="step-in">
        <h2 className="font-display text-[1.6rem] leading-tight font-bold tracking-[-0.01em]">Check your email.</h2>
        <p className="mt-2 text-ink-soft">
          A sign-in link is on its way to <span className="font-semibold text-ink">{sentTo}</span>. It works for 15
          minutes.
        </p>
        {devLink && (
          <p className="mt-4 rounded-xl bg-mint-wash p-3 text-[0.95rem]">
            Test mode, no email was sent.{" "}
            <a href={devLink} className="font-semibold text-green underline underline-offset-4">
              Open the sign-in link
            </a>
          </p>
        )}
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-5 text-[0.95rem] font-semibold text-green underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div>
      <a
        href="/api/auth/google/start"
        className="press flex h-14 w-full items-center justify-center gap-3 rounded-full border-2 border-line bg-pad text-[1.125rem] font-semibold hover:border-ink"
      >
        <GoogleMark />
        Continue with Google
      </a>

      <div className="my-5 flex items-center gap-3 text-[0.9rem] text-ink-soft" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} noValidate>
        <label htmlFor="email" className="block font-semibold">
          Email
        </label>
        <p id="email-hint" className="text-[0.95rem] text-ink-soft">
          Wally emails you a link. No password to remember.
        </p>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby="email-hint"
          className="mt-1.5 h-14 w-full rounded-xl border-2 border-line bg-pad px-4 text-[1.2rem] font-medium transition-colors focus:border-green focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="press mt-4 flex h-14 w-full items-center justify-center rounded-full bg-green text-[1.125rem] font-semibold text-white hover:bg-green-deep disabled:opacity-70"
        >
          {busy ? "Sending link…" : "Email me a sign-in link"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red/40 bg-red/5 p-3 text-[0.95rem] font-medium text-red">
          {error}
        </p>
      )}

      <p className="mt-5 text-center text-[0.95rem] text-ink-soft">
        Rather use your phone?{" "}
        <Link href="/join" className="font-semibold text-green underline-offset-4 hover:underline">
          Sign up by text
        </Link>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.700z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.900l-3.9-3c-1.1.700-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.300v3.100A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.300a7.2 7.2 0 0 1 0-4.600V6.600H1.300a12 12 0 0 0 0 10.800l4-3.100z" />
      <path fill="#EA4335" d="M12 4.800c1.8 0 3.3.600 4.6 1.800l3.4-3.400A12 12 0 0 0 1.3 6.600l4 3.100c.900-2.9 3.6-4.9 6.7-4.900z" />
    </svg>
  );
}
