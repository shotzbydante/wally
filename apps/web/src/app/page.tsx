import Link from "next/link";
import type { CSSProperties } from "react";
import { Wally } from "@/components/Wally";

const asks = [
  "my usual from the Thai place",
  "table for 4 Friday around 8, Italian, Silver Lake",
  "something spicy under $25, here in 30 minutes",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-5 py-8 sm:px-8 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-10 min-[900px]:py-12">
      <div className="order-2 min-[900px]:order-1 min-[900px]:flex-1">
        <h1 className="arrive font-display text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.01em] sm:text-6xl">
          Wally is a waiter you can text.
        </h1>
        <p className="arrive mt-5 max-w-[34rem] text-xl text-ink-soft" style={{ "--d": "120ms" } as CSSProperties}>
          He orders your food and books your tables. There is no app to
          learn. You text him, he sorts it out, and he checks with you
          before he spends a cent.
        </p>

        <ul className="mt-8 flex flex-col items-start gap-2.5" aria-label="Things you can text Wally">
          {asks.map((ask, i) => (
            <li key={ask} style={{ "--d": `${700 + i * 450}ms` } as CSSProperties} className="sent rounded-[1.35rem] rounded-bl-md bg-green px-4 py-2.5 text-[1.0625rem] text-white">
              {ask}
            </li>
          ))}
        </ul>

        <div style={{ "--d": "2100ms" } as CSSProperties} className="arrive mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/join"
            className="press inline-flex h-14 items-center rounded-full bg-green px-8 font-display text-xl font-medium text-white hover:bg-green-deep"
          >
            Meet Wally
          </Link>
          <p className="text-[0.95rem] text-ink-soft">Takes about a minute. Wally is an AI.</p>
        </div>
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
