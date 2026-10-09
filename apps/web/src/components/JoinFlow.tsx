"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Wally } from "@/components/Wally";
import {
  cleanFirstName,
  firstTextLink,
  formatUsPhone,
  isFirstName,
  isZip,
  normalizeUsPhone,
} from "@/lib/signup";

type Step = "name" | "contact" | "texts" | "code" | "ready";
const order: Step[] = ["name", "contact", "texts", "code", "ready"];
const TOTAL = 4; // steps the user completes; "ready" is the result.
const RESEND_SECONDS = 30;

const problems: Record<string, string> = {
  not_configured: "Text verification isn’t switched on yet, so no code was sent.",
  invalid_number: "That number can’t receive texts. Check it and try again.",
  rate_limited: "Too many attempts for this number. Wait a few minutes, then try again.",
  wrong_code: "That code doesn’t match. Check the text and try again.",
  expired: "That code has expired. Send a new one.",
  provider_error: "The text service didn’t respond. Try again in a moment.",
  invalid_input: "Some details look wrong. Go back and check them.",
  network: "Couldn’t reach Wally. Check your connection and try again.",
};

export function JoinFlow({ wallyNumber }: { wallyNumber: string | null }) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [suggestions, setSuggestions] = useState(false);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const first = cleanFirstName(name);

  // Wally "types" briefly before each new line, then focus moves to it
  // so screen readers hear what he said.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      requestAnimationFrame(() => lineRef.current?.focus());
    }, 550);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const go = (next: Step) => {
    setErrors({});
    setStep(next);
  };
  const back = () => {
    setCode("");
    go(step === "ready" ? "name" : (order[Math.max(0, order.indexOf(step) - 1)] ?? "name"));
  };

  const details = () => ({ name: first, phone, zip: zip.trim(), suggestions });

  const post = async (path: string, body: object): Promise<string | null> => {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return data.error ?? "provider_error";
    } catch {
      return "network";
    }
  };

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    if (!isFirstName(name)) return setErrors({ name: "Enter your first name, letters only." });
    go("contact");
  };

  const submitContact = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!normalizeUsPhone(phone)) next.phone = "Enter a 10-digit US mobile number.";
    if (!isZip(zip)) next.zip = "Enter a 5-digit ZIP code.";
    if (Object.keys(next).length) return setErrors(next);
    go("texts");
  };

  const sendCode = async () => {
    setBusy(true);
    const error = await post("/api/verify/start", details());
    setBusy(false);
    if (error) {
      setErrors({ form: problems[error] ?? problems.provider_error! });
      return false;
    }
    setResendIn(RESEND_SECONDS);
    return true;
  };

  const submitTexts = async (e: FormEvent) => {
    e.preventDefault();
    if (await sendCode()) go("code");
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6-digit code from the text." });
    setBusy(true);
    const error = await post("/api/verify/check", { ...details(), code });
    setBusy(false);
    if (error) return setErrors({ code: problems[error] ?? problems.provider_error! });
    go("ready");
  };

  const lines: Record<Step, string> = {
    name: "Good evening! I’m Wally, and I’ll be looking after you. What should I call you?",
    contact: `${first}! Wonderful. Where should I text you?`,
    texts: `Nearly there, ${first}. A quick word on how I text.`,
    code: `I’ve just texted you a code, ${first}. Read it back to me?`,
    ready: `That’s you, ${first}. Welcome in.`,
  };

  const stepNumber = Math.min(order.indexOf(step) + 1, TOTAL);
  const done = step === "ready";

  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-5 pt-5 pb-10 sm:px-8 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-12 min-[900px]:py-10">
      {/* Wally and what he's saying */}
      <section className="relative mx-auto flex w-full max-w-[440px] items-end gap-1 min-[900px]:mx-0 min-[900px]:w-[440px] min-[900px]:shrink-0 min-[900px]:flex-col min-[900px]:items-stretch min-[900px]:gap-0">
        <div className="order-2 min-w-0 flex-1 pb-6 min-[900px]:order-1 min-[900px]:flex-none min-[900px]:pb-0">
          {typing ? (
            <p
              className="say inline-flex gap-1.5 rounded-[1.6rem] rounded-bl-md bg-ink px-5 py-5 min-[900px]:ml-10"
              aria-label="Wally is typing"
            >
              {[0, 150, 300].map((d) => (
                <span key={d} style={{ "--d": `${d}ms` } as CSSProperties} className="dot block size-2.5 rounded-full bg-white" />
              ))}
            </p>
          ) : (
            <p
              key={step}
              ref={lineRef}
              tabIndex={-1}
              className="say relative rounded-[1.6rem] rounded-bl-md bg-ink px-5 py-4 font-display text-[1.2rem] leading-snug font-medium text-white outline-none min-[900px]:ml-10 min-[900px]:rounded-[1.75rem] min-[900px]:rounded-bl-md min-[900px]:px-6 min-[900px]:py-5 min-[900px]:text-[1.6rem]"
            >
              {lines[step]}
            </p>
          )}
        </div>
        <div key={`w-${step}`} className="wally-hop order-1 w-[38%] shrink-0 min-[900px]:order-2 min-[900px]:-mt-2 min-[900px]:w-full">
          <div className="wally-float">
            <Wally priority className="w-full" />
          </div>
        </div>
      </section>

      {/* The order pad */}
      <section className="mx-auto mt-2 w-full max-w-[440px] min-[900px]:mt-0 min-[900px]:max-w-[460px] min-[900px]:flex-1" aria-label="Sign up">
        <div className="relative rounded-[1.25rem] bg-pad shadow-[0_1px_0_var(--line),0_18px_40px_-18px_rgba(22,26,43,0.28)]">
          <PadBinding />
          <div className="pad-rules rounded-b-[1.25rem] px-6 pt-5 pb-7 pl-[3.4rem] sm:pr-8">
            <Progress step={stepNumber} done={done} onBack={stepNumber > 1 || done ? back : undefined} backLabel={done ? "Start over" : "Back"} />

            <div key={step} className="step-in">
              {/* What Wally has written down so far */}
              {stepNumber > 1 && (
                <dl className="mt-4 border-b border-line pb-3">
                  <Noted label="Name" value={first} />
                  {stepNumber > 2 && <Noted label="Mobile" value={formatUsPhone(phone)} tick={done} />}
                  {stepNumber > 2 && <Noted label="ZIP" value={zip.trim()} />}
                </dl>
              )}

              {step === "name" && (
                <form onSubmit={submitName} noValidate className="mt-5">
                  <Field label="First name" value={name} onChange={setName} error={errors.name} autoComplete="given-name" autoFocus />
                  <Submit>Next</Submit>
                </form>
              )}

              {step === "contact" && (
                <form onSubmit={submitContact} noValidate className="mt-5">
                  <Field
                    label="Mobile number"
                    hint="I’ll text a code to this number to confirm it’s yours."
                    value={phone}
                    onChange={(v) => setPhone(formatUsPhone(v))}
                    error={errors.phone}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(310) 555-0142"
                    autoFocus
                  />
                  <Field
                    label="ZIP code"
                    hint="So I know which kitchens are near you."
                    value={zip}
                    onChange={(v) => setZip(v.replace(/\D/g, "").slice(0, 5))}
                    error={errors.zip}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    className="mt-5"
                  />
                  <Submit>Next</Submit>
                </form>
              )}

              {step === "texts" && (
                <form onSubmit={submitTexts} className="mt-5">
                  <ul className="space-y-2.5 text-[1rem]">
                    <li>Wally is an AI assistant, not a person.</li>
                    <li>
                      He texts {formatUsPhone(phone)} a verification code now, and later about your orders and
                      reservations. Message and data rates may apply.
                    </li>
                    <li>Reply STOP at any time to end texts, or HELP for help.</li>
                  </ul>
                  <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 transition-colors has-[:checked]:border-green has-[:checked]:bg-mint-wash">
                    <input
                      type="checkbox"
                      checked={suggestions}
                      onChange={(e) => setSuggestions(e.target.checked)}
                      className="mt-1 size-5 shrink-0 accent-[var(--green)]"
                    />
                    <span>
                      <span className="font-semibold">Send me suggestions too</span>
                      <span className="block text-[0.95rem] text-ink-soft">
                        Optional. An occasional idea, like reordering a favorite.
                      </span>
                    </span>
                  </label>
                  <FormError message={errors.form} />
                  <Submit busy={busy} busyLabel="Sending code…">
                    Agree and text me a code
                  </Submit>
                </form>
              )}

              {step === "code" && (
                <form onSubmit={submitCode} noValidate className="mt-5">
                  <Field
                    label="6-digit code"
                    hint={`Sent by text to ${formatUsPhone(phone)}.`}
                    value={code}
                    onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                    error={errors.code}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    inputClassName="text-center tracking-[0.45em] tabular-nums"
                  />
                  <Submit busy={busy} busyLabel="Checking…">
                    Verify
                  </Submit>
                  <p className="mt-4 text-center text-[0.95rem] text-ink-soft">
                    {resendIn > 0 ? (
                      `No text yet? You can send another in ${resendIn}s.`
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setErrors({});
                          await sendCode();
                        }}
                        className="font-medium text-green underline-offset-4 hover:underline"
                      >
                        Send a new code
                      </button>
                    )}
                  </p>
                  <FormError message={errors.form} />
                </form>
              )}

              {done && (
                <div className="mt-5">
                  <h2 className="flex items-center gap-3 font-display text-[1.7rem] leading-tight font-semibold">
                    <Tick />
                    You’re verified.
                  </h2>
                  <p className="mt-2 text-ink-soft">Two things left, in this order.</p>
                  <ol className="mt-4 space-y-4">
                    <li className="flex gap-3">
                      <Num n={1} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">Open your account</p>
                        <p className="text-[0.95rem] text-ink-soft">See what Wally has on his pad for you.</p>
                        <Link
                          href="/account"
                          className="press mt-3 flex h-14 w-full items-center justify-center rounded-full bg-green font-display text-xl font-medium text-white hover:bg-green-deep"
                        >
                          Go to my account
                        </Link>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <Num n={2} muted={!wallyNumber} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">Text Wally your first order</p>
                        {wallyNumber ? (
                          <>
                            <p className="text-[0.95rem] text-ink-soft">Opens your messages with “Hi Wally” ready to send.</p>
                            <a
                              href={firstTextLink(wallyNumber)}
                              className="press mt-3 flex h-14 w-full items-center justify-center rounded-full border-2 border-green font-display text-xl font-medium text-green hover:bg-mint-wash"
                            >
                              Text Wally
                            </a>
                          </>
                        ) : (
                          <p className="text-[0.95rem] text-ink-soft">
                            Not available yet. Wally’s phone line isn’t open, so there is nothing to do here for now.
                          </p>
                        )}
                      </div>
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-[0.9rem] text-ink-soft">
          <Link href="/" className="underline-offset-4 hover:underline">
            What is Wally?
          </Link>
        </p>
      </section>
    </main>
  );
}

function Progress({ step, done, onBack, backLabel }: { step: number; done: boolean; onBack?: () => void; backLabel: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-[1.05rem] font-medium">{done ? "All 4 steps done" : `Step ${step} of ${TOTAL}`}</p>
        {onBack && (
          <button type="button" onClick={onBack} className="text-[0.95rem] font-medium text-green underline-offset-4 hover:underline">
            {backLabel}
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <span
              className="block h-full rounded-full bg-mint transition-transform duration-500 ease-out"
              style={{ transform: `scaleX(${done || i < step ? 1 : 0})`, transformOrigin: "left" }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function PadBinding() {
  return (
    <div className="flex h-9 items-center justify-between rounded-t-[1.25rem] bg-ink px-7" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="block size-2.5 rounded-full bg-paper/90" />
      ))}
    </div>
  );
}

function Tick() {
  return (
    <svg className="tick size-9 shrink-0" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="var(--green)" />
      <path d="M10.5 18.5l5 5 10-11" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Num({ n, muted = false }: { n: number; muted?: boolean }) {
  return (
    <span
      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full font-display text-[0.95rem] font-semibold ${
        muted ? "bg-line text-ink-soft" : "bg-ink text-white"
      }`}
      aria-hidden="true"
    >
      {n}
    </span>
  );
}

function Noted({ label, value, tick = false }: { label: string; value: string; tick?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 py-1">
      <dt className="w-20 shrink-0 text-[0.95rem] text-ink-soft">{label}</dt>
      <dd className="min-w-0 font-display text-[1.15rem] font-medium break-words">
        {value}
        {tick && <span className="ml-2 font-sans text-[0.9rem] font-semibold text-green">Verified</span>}
      </dd>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-4 rounded-xl border border-red/40 bg-red/5 p-3 text-[0.95rem] font-medium text-red">
      {message}
    </p>
  );
}

function Submit({ children, busy = false, busyLabel }: { children: ReactNode; busy?: boolean; busyLabel?: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="press mt-6 flex h-14 w-full items-center justify-center rounded-full bg-green font-display text-xl font-medium text-white hover:bg-green-deep disabled:opacity-70"
    >
      {busy ? busyLabel : children}
    </button>
  );
}

function Field({
  label,
  hint,
  error,
  value,
  onChange,
  className = "",
  inputClassName = "",
  ...input
}: {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-[0.95rem] text-ink-soft">
          {hint}
        </p>
      )}
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 h-14 w-full rounded-xl border-2 bg-pad px-4 font-display text-[1.35rem] font-medium transition-colors placeholder:font-normal placeholder:text-ink-soft/50 focus:border-green focus:outline-none ${
          error ? "border-red" : "border-line"
        } ${inputClassName}`}
        {...input}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[0.95rem] font-medium text-red">
          {error}
        </p>
      )}
    </div>
  );
}
