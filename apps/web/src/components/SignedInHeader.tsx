import Link from "next/link";

const tabs = [
  { href: "/ask", label: "Ask Wally" },
  { href: "/account", label: "Account" },
] as const;

/** Header for signed-in pages: the two places a member can be. */
export function SignedInHeader({ active }: { active: (typeof tabs)[number]["href"] }) {
  return (
    <header className="mx-auto flex w-full max-w-[1080px] items-center justify-between gap-3 px-5 pt-5 sm:px-8">
      <Link href="/" className="font-display text-[1.35rem] font-bold tracking-[-0.02em]">
        Wally
      </Link>
      <nav aria-label="Your Wally" className="flex rounded-full bg-pad p-1 text-[0.95rem] font-semibold ring-1 ring-line ring-inset">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === active ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-full px-4 transition-colors ${
              tab.href === active ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
