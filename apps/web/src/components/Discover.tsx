"use client";

import Link from "next/link";
import { Wally } from "@/components/Wally";
import { capture } from "@/lib/analytics";
import { soon, type IdeaSection } from "@/lib/discover";

/**
 * The Discover tab: everything Wally can do, as ideas to tap. Each one opens
 * Ask Wally and sends its first message (see src/lib/discover.ts).
 */
export function Discover({ sections, text }: { sections: IdeaSection[]; text?: { href: string; connected: boolean } }) {
  return (
    <main className="mx-auto w-full max-w-[680px] flex-1 px-5 pt-5 pb-20 sm:px-8 sm:pt-8">
      <h1 className="sr-only">Discover what Wally can do</h1>
      <div className="flex items-end gap-3 sm:gap-5">
        <div className="w-[30%] max-w-36 shrink-0">
          <div className="wally-enter">
            <div className="wally-float">
              <Wally priority className="w-full" />
            </div>
          </div>
        </div>
        <p className="say fill-ink mb-6 rounded-[1.6rem] rounded-bl-md bg-ink px-5 py-4 text-[1.15rem] leading-snug font-semibold text-white sm:px-6 sm:py-5 sm:text-[1.35rem]" style={{ animationDelay: "380ms" }}>
          Here’s everything I can do for you. Tap one and we’ll get started.
        </p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="mt-9 first-of-type:mt-6">
          <h2 className="font-display text-[1.5rem] font-bold tracking-[-0.02em]">{section.title}</h2>
          <ul className="mt-1 divide-y divide-line">
            {section.ideas.map((idea) => (
              <li key={idea.id}>
                <Link
                  href={`/ask?start=${idea.id}`}
                  onClick={() => capture("discover_idea_opened", { idea: idea.id })}
                  className="idea press group -mx-3 flex items-center gap-4 rounded-2xl px-3 py-4 hover:bg-pad"
                >
                  <Plate>{idea.emoji}</Plate>
                  <Words title={idea.title} detail={idea.detail} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {text && (
        <section className="mt-9">
          <h2 className="font-display text-[1.5rem] font-bold tracking-[-0.02em]">On your phone</h2>
          <ul className="mt-1">
            <li>
              <a
                href={text.href}
                onClick={() => capture("discover_idea_opened", { idea: text.connected ? "text" : "connect_phone" })}
                className="idea press group -mx-3 flex items-center gap-4 rounded-2xl px-3 py-4 hover:bg-pad"
              >
                <Plate>💬</Plate>
                {text.connected ? (
                  <Words title="Text me anytime. I’m in your contacts." detail="Texts and this site are one conversation, so pick up wherever you left off." />
                ) : (
                  <Words title="Connect your phone and text me anytime." detail="Send me one text and our conversation follows you there." />
                )}
              </a>
            </li>
          </ul>
        </section>
      )}

      <section className="mt-9">
        <h2 className="font-display text-[1.5rem] font-bold tracking-[-0.02em] text-ink-soft">Coming soon</h2>
        <ul className="mt-1 divide-y divide-line">
          {soon.map((idea) => (
            <li key={idea.title} className="flex items-center gap-4 py-4">
              <Plate soon>{idea.emoji}</Plate>
              <Words title={idea.title} detail={idea.detail} soon />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/** The emoji, served on a little plate. It lifts off the table when its row is pressed or hovered. */
function Plate({ children, soon = false }: { children: string; soon?: boolean }) {
  return (
    <span className={`plate shrink-0 ${soon ? "plate-soon" : ""}`} aria-hidden="true">
      <span>{children}</span>
    </span>
  );
}

function Words({ title, detail, soon = false }: { title: string; detail: string; soon?: boolean }) {
  return (
    <span className="min-w-0 flex-1">
      <span className={`block text-[1.075rem] leading-snug font-semibold sm:text-[1.15rem] ${soon ? "text-ink-soft" : "text-ink"}`}>{title}</span>
      <span className="mt-0.5 block text-[0.95rem] leading-snug text-ink-soft">{detail}</span>
    </span>
  );
}
