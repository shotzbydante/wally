import Link from "next/link";

const tabs = [
  { href: "/ask", label: "Ask Wally" },
  { href: "/account", label: "Account" },
] as const;

/** Header for signed-in pages: the two places a member can be. */
export function SignedInHeader({
  active,
  text,
}: {
  active: (typeof tabs)[number]["href"];
  /** Where the "Text Wally" button goes: his thread in Messages once the phone is connected, the account page until then. Left out while his line isn't open. */
  text?: { href: string; connected: boolean };
}) {
  return (
    // Pinned to the top, so the tabs are in reach however long the conversation gets.
    // LocationBar and AskWally sit below it and assume its height: 3rem on phones, 3.75rem from the sm width up.
    <div className="sticky top-0 z-30 bg-paper/95 backdrop-blur">
    <header className="mx-auto flex h-12 w-full max-w-[1080px] items-center justify-between gap-3 px-5 sm:h-[3.75rem] sm:px-8">
      <Link href="/" className="font-display text-[1.35rem] font-bold tracking-[-0.02em]">
        Wally
      </Link>
      {text && (
        <a
          href={text.href}
          className="press fill-green mr-auto ml-1 inline-flex h-8 items-center sm:h-9 gap-1.5 rounded-full bg-green px-3 text-[0.9rem] font-semibold text-white hover:brightness-110"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
            <path d="M12 3C6.5 3 2 6.8 2 11.500c0 2.5 1.3 4.8 3.4 6.300L4.5 21l4-1.600c1.1.300 2.3.500 3.5.500 5.5 0 10-3.8 10-8.400S17.5 3 12 3z" />
          </svg>
          <span className="min-[431px]:hidden">Text</span>
          <span className="max-[430px]:hidden">{text.connected ? "Text Wally" : "Connect your phone"}</span>
        </a>
      )}
      <nav aria-label="Your Wally" className="flex shrink-0 rounded-full bg-pad p-1 text-[0.95rem] font-semibold whitespace-nowrap ring-1 ring-line ring-inset">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === active ? "page" : undefined}
            className={`inline-flex h-8 items-center rounded-full px-3 transition-colors sm:h-9 sm:px-4 ${
              tab.href === active ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
    </div>
  );
}
