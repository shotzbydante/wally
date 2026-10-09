"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Wally } from "@/components/Wally";
import {
  cleanFirstName,
  firstTextLink,
  formatUsPhone,
  isFirstName,
  isZip,
  normalizeUsPhone,
} from "@/lib/signup";

type Step = "name" | "contact" | "texts" | "ready";
const order: Step[] = ["name", "contact", "texts", "ready"];

export function JoinFlow({ wallyNumber }: { wallyNumber: string | null }) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [suggestions, setSuggestions] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const headingRef = useRef<HTMLParagraphElement>(null);
  const first = cleanFirstName(name);

  // Move focus to Wally's line on each step so screen readers hear it.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [step]);

  const go = (next: Step) => {
    setErrors({});
    setStep(next);
  };
  const back = () => go(order[Math.max(0, order.indexOf(step) - 1)] ?? "name");

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
  const submitTexts = (e: FormEvent) => {
    e.preventDefault();
    go("ready");
  };

  const lines: Record<Step, string> = {
    name: "Good evening! I'm Wally, and I'll be looking after you. What should I call you?",
    contact: `${first}! Wonderful. Where should I text you?`,
    texts: `Nearly there, ${first}. A quick word on how I text.`,
    ready: `Your table is ready, ${first}. Send me a hello and I'll take it from there.`,
  };

  const stepNumber = order.indexOf(step) + 1;

  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-5 pt-5 pb-10 sm:px-8 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-12 min-[900px]:py-10">
      {/* Wally and what he's saying */}
      <section className="relative mx-auto flex w-full max-w-[440px] items-end gap-1 min-[900px]:mx-0 min-[900px]:w-[440px] min-[900px]:shrink-0 min-[900px]:flex-col min-[900px]:items-stretch min-[900px]:gap-0">
        <div className="order-2 min-w-0 flex-1 pb-6 min-[900px]:order-1 min-[900px]:flex-none min-[900px]:pb-0">
          <p
            key={step}
            ref={headingRef}
            tabIndex={-1}
            className="say relative rounded-[1.6rem] rounded-bl-md bg-ink px-5 py-4 font-display text-[1.2rem] leading-snug font-medium text-white outline-none min-[900px]:ml-10 min-[900px]:rounded-[1.75rem] min-[900px]:rounded-bl-md min-[900px]:px-6 min-[900px]:py-5 min-[900px]:text-[1.6rem]"
          >
            {lines[step]}
          </p>
        </div>
        <div key={`w-${step}`} className="wally-hop order-1 w-[38%] shrink-0 min-[900px]:order-2 min-[900px]:-mt-2 min-[900px]:w-full">
          <Wally priority className="w-full" />
        </div>
      </section>

      {/* The order pad */}
      <section className="mx-auto mt-2 w-full max-w-[440px] min-[900px]:mt-0 min-[900px]:flex-1 min-[900px]:max-w-[460px]" aria-label="Sign up">
        <div className="relative rounded-[1.25rem] bg-pad shadow-[0_1px_0_var(--line),0_18px_40px_-18px_rgba(22,26,43,0.28)]">
          <PadBinding />
          <div className="pad-rules rounded-b-[1.25rem] px-6 pt-5 pb-7 pl-[3.4rem] sm:pr-8">
            <div className="flex items-baseline justify-between text-[0.95rem] text-ink-soft">
              <span>{step === "ready" ? "Order taken" : `Step ${stepNumber} of 3`}</span>
              {stepNumber > 1 && (
                <button type="button" onClick={back} className="font-medium text-green underline-offset-4 hover:underline">
                  {step === "ready" ? "Edit details" : "Back"}
                </button>
              )}
            </div>

            {/* What Wally has written down so far */}
            {stepNumber > 1 && (
              <dl className="mt-3 border-b border-line pb-3">
                <Noted label="Name" value={first} />
                {stepNumber > 2 && <Noted label="Mobile" value={formatUsPhone(phone)} />}
                {stepNumber > 2 && <Noted label="ZIP" value={zip.trim()} />}
                {step === "ready" && <Noted label="Suggestions" value={suggestions ? "Yes, now and then" : "No thanks"} />}
              </dl>
            )}

            {step === "name" && (
              <form onSubmit={submitName} noValidate className="mt-5">
                <Field
                  label="First name"
                  value={name}
                  onChange={setName}
                  error={errors.name}
                  autoComplete="given-name"
                  autoFocus
                />
                <Submit>Continue</Submit>
              </form>
            )}

            {step === "contact" && (
              <form onSubmit={submitContact} noValidate className="mt-5">
                <Field
                  label="Mobile number"
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
                <Submit>Continue</Submit>
              </form>
            )}

            {step === "texts" && (
              <form onSubmit={submitTexts} className="mt-5">
                <ul className="space-y-2.5 text-[1rem]">
                  <li>Wally is an AI assistant, not a person.</li>
                  <li>
                    He texts {formatUsPhone(phone)} about your orders and reservations. Message and data rates may
                    apply.
                  </li>
                  <li>Reply STOP at any time to end texts, or HELP for help.</li>
                </ul>
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 has-[:checked]:border-green has-[:checked]:bg-mint-wash">
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
                <Submit>Agree and continue</Submit>
              </form>
            )}

            {step === "ready" && (
              <div className="mt-5">
                {wallyNumber ? (
                  <>
                    <a
                      href={firstTextLink(wallyNumber)}
                      className="flex h-14 w-full items-center justify-center rounded-full bg-green font-display text-xl font-medium text-white transition-colors hover:bg-green-deep"
                    >
                      Text Wally
                    </a>
                    <p className="mt-3 text-[0.95rem] text-ink-soft">
                      Opens your messages with “Hi Wally” ready to send. Your sign-up is complete once you send it.
                    </p>
                  </>
                ) : (
                  <p className="rounded-xl bg-mint-wash p-4 text-[1rem]">
                    Wally’s phone line isn’t connected yet, so there is no number to text. Your details have not been
                    saved.
                  </p>
                )}
              </div>
            )}
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

function PadBinding() {
  return (
    <div className="flex h-9 items-center justify-between rounded-t-[1.25rem] bg-ink px-7" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="block size-2.5 rounded-full bg-paper/90" />
      ))}
    </div>
  );
}

function Noted({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 py-1">
      <dt className="w-24 shrink-0 text-[0.95rem] text-ink-soft">{label}</dt>
      <dd className="min-w-0 font-display text-[1.15rem] font-medium break-words">{value}</dd>
    </div>
  );
}

function Submit({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-green font-display text-xl font-medium text-white transition-colors hover:bg-green-deep"
    >
      {children}
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
  ...input
}: {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
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
        className={`mt-1.5 h-14 w-full rounded-xl border-2 bg-pad px-4 font-display text-[1.35rem] font-medium placeholder:font-normal placeholder:text-ink-soft/50 focus:border-green focus:outline-none ${
          error ? "border-red" : "border-line"
        }`}
        {...input}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[0.95rem] font-medium text-red">
          {error}
        </p>
      )}
    </div>
  );
}
