import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-[1080px] items-center justify-between px-5 pt-5 sm:px-8">
      <Link href="/" className="font-display text-[1.35rem] font-bold tracking-[-0.02em]">
        Wally
      </Link>
      <nav className="flex items-center gap-5 text-[0.95rem] font-semibold">{children}</nav>
    </header>
  );
}
