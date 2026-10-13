import Link from "next/link";
import type { CSSProperties } from "react";
import { Wally } from "@/components/Wally";

const asks = [
  "who has the best pad thai near me?",
  "table for 4 Friday around 8, Italian, Silver Lake",
  "burgers tonight, straight from a local spot",
];

const promises = [
  { title: "Every option", detail: "The delivery apps and the restaurants’ own sites, in one place." },
  { title: "Local first", detail: "I start with the restaurant itself, so you can order direct." },
  { title: "Your call", detail: "Nothing is ordered or booked until you say yes." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-5 py-8 sm:px-8 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-10 min-[900px]:py-12">
      <div className="order-2 min-[900px]:order-1 min-[900px]:flex-1">
        <h1 className="arrive font-display text-[2.15rem] leading-[1.1] font-bold tracking-[-0.02em] sm:text-5xl min-[900px]:text-[3.25rem]">
          Hi, I’m Wally, your personal waiter. <span className="block text-green">What can I serve up for you today?</span>
        </h1>
        <p className="arrive mt-5 max-w-[34rem] text-[1.15rem] text-ink-soft sm:text-xl" style={{ "--d": "120ms" } as CSSProperties}>
          Tell me what you’re craving and I’ll track it down, across the delivery apps and the restaurants’ own sites.
          No tabs to juggle and no app to learn.
        </p>

        <ul className="mt-7 flex flex-col items-start gap-2.5" aria-label="Things you can ask Wally">
          {asks.map((ask, i) => (
            <li key={ask} style={{ "--d": `${700 + i * 450}ms` } as CSSProperties} className="sent rounded-[1.35rem] rounded-bl-md bg-green px-4 py-2.5 text-[1.0625rem] text-white">
              {ask}
            </li>
          ))}
        </ul>

        <div style={{ "--d": "2100ms" } as CSSProperties} className="arrive mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/join"
            className="press inline-flex h-14 items-center rounded-full bg-green px-8 font-display text-[1.125rem] font-semibold text-white hover:bg-green-deep"
          >
            Meet Wally
          </Link>
          <Link href="/signin" className="font-semibold text-green underline-offset-4 hover:underline">
            Sign in
          </Link>
          <p className="basis-full text-[0.95rem] text-ink-soft">Takes about a minute. Wally is an AI.</p>
        </div>

        <dl style={{ "--d": "2300ms" } as CSSProperties} className="arrive mt-10 grid gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-3">
          {promises.map((p) => (
            <div key={p.title}>
              <dt className="font-display font-semibold">{p.title}</dt>
              <dd className="mt-0.5 text-[0.95rem] leading-snug text-ink-soft">{p.detail}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="order-1 mx-auto w-[58%] max-w-[260px] min-[900px]:order-2 min-[900px]:w-[440px] min-[900px]:max-w-none min-[900px]:shrink-0">
        <div className="wally-enter">
          <div className="wally-float">
            <Wally priority className="w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
