import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AnalyticsUser } from "@/components/AnalyticsUser";
import { Discover } from "@/components/Discover";
import { Notice, noticeAction } from "@/components/Notice";
import { SignedInHeader } from "@/components/SignedInHeader";
import { sections } from "@/lib/discover";
import { loadAccount } from "@/lib/server/accounts";
import { orderingConfigured } from "@/lib/server/ordering";
import { SESSION_COOKIE, sessionSecret } from "@/lib/server/session";
import { firstTextLink } from "@/lib/signup";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <Suspense fallback={<p className="p-8 text-ink-soft">Wally is laying the table…</p>}>
      <Ideas />
    </Suspense>
  );
}

async function Ideas() {
  // Read the cookie first: this is what makes the page render per request.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // Checking the session's expiry reads the clock, which needs a real request.
  await connection();
  const loaded = await loadAccount(token, sessionSecret());
  if (loaded.state === "upgrade") redirect("/api/session/upgrade");
  if (loaded.state === "signed_out") {
    return (
      <Notice title="You’re not signed in." detail="Sign in to see what Wally can do for you.">
        <Link href="/signin" className={noticeAction}>
          Sign in
        </Link>
      </Notice>
    );
  }
  if (loaded.state === "unavailable") {
    return (
      <Notice title="Wally can’t be reached right now." detail="His records didn’t respond. Nothing has been changed.">
        <a href="/discover" className={noticeAction}>
          Try again
        </a>
      </Notice>
    );
  }

  const account = loaded.account;
  const wallyNumber = process.env.NEXT_PUBLIC_WALLY_NUMBER ?? null;
  const text = wallyNumber ? { href: account.phone ? firstTextLink(wallyNumber, "") : "/account#texting", connected: Boolean(account.phone) } : undefined;
  // Only offer what works here: ordering needs its connector switched on.
  const ordering = orderingConfigured();
  const shown = sections.map((s) => ({ ...s, ideas: s.ideas.filter((i) => i.needs !== "ordering" || ordering) })).filter((s) => s.ideas.length > 0);

  return (
    <>
      {loaded.kept === "database" && account.id && <AnalyticsUser id={account.id} email={Boolean(account.email)} google={Boolean(account.google)} phone={Boolean(account.phone)} address={Boolean(account.address)} />}
      <SignedInHeader active="/discover" text={text} />
      <Discover sections={shown} text={text} />
    </>
  );
}
