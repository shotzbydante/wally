import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Wally } from "@/components/Wally";

/** Shared style for the one action a notice offers. */
export const noticeAction =
  "press mt-6 inline-flex h-14 items-center rounded-full bg-green px-8 text-[1.125rem] font-semibold text-white hover:bg-green-deep";

/** A full-page message from Wally: signed out, or something couldn't be loaded. */
export function Notice({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-start justify-center px-5 py-10 sm:px-8">
        <div className="wally-float w-36">
          <Wally priority className="w-full" />
        </div>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-[-0.02em]">{title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{detail}</p>
        {children}
      </main>
    </>
  );
}
