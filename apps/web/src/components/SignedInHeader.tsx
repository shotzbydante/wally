import Link from "next/link";
import { WallyFace } from "@/components/WallyFace";

const tabs = [
  { href: "/ask", label: "Ask Wally" },
  { href: "/discover", label: "Discover" },
  { href: "/account", label: "Account" },
] as const;

/**
 * Header for signed-in pages: the three places a member can be.
 * Below the sm width (640px) three tabs leave no room for the wordmark and a labelled button,
 * so Wally's face stands in for the wordmark and Text becomes a round icon.
 */
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
    <header className="mx-auto flex h-12 w-full max-w-[1080px] items-center justify-between gap-2 px-5 sm:h-[3.75rem] sm:gap-3 sm:px-8">
      <Link href="/" className="shrink-0 font-display text-[1.35rem] font-bold tracking-[-0.02em]">
        <span className="max-sm:hidden">Wally</span>
        <span className="sm:hidden">
          <WallyFace className="block size-8 rounded-full" />
          <span className="sr-only">Wally</span>
        </span>
      </Link>
      {text && (
        <a
          href={text.href}
          aria-label={text.connected ? "Text Wally" : "Connect your phone"}
          className="press fill-green mr-auto inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-green text-[0.9rem] font-semibold text-white hover:brightness-110 max-sm:w-8 sm:ml-1 sm:h-9 sm:px-3"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
            <path d="M12 3C6.5 3 2 6.8 2 11.500c0 2.5 1.3 4.8 3.4 6.300L4.5 21l4-1.600c1.1.300 2.3.500 3.5.500 5.5 0 10-3.8 10-8.400S17.5 3 12 3z" />
          </svg>
          <span className="max-sm:hidden" aria-hidden="true">{text.connected ? "Text Wally" : "Connect your phone"}</span>
        </a>
      )}
      <nav aria-label="Your Wally" className="ml-auto flex shrink-0 rounded-full bg-pad p-1 font-semibold whitespace-nowrap ring-1 ring-line ring-inset">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === active ? "page" : undefined}
            className={`inline-flex h-8 items-center rounded-full px-2.5 text-[0.875rem] transition-colors sm:h-9 sm:px-4 sm:text-[0.95rem] ${
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
