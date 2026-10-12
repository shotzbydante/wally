import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AskWally } from "@/components/AskWally";
import { Notice, noticeAction } from "@/components/Notice";
import { SignedInHeader } from "@/components/SignedInHeader";
import type { ChatMessage } from "@/lib/chat";
import { loadAccount } from "@/lib/server/accounts";
import { agentConfigured } from "@/lib/server/agent";
import { loadMessages } from "@/lib/server/conversation";
import { DbError } from "@/lib/server/db";
import { placesConfigured } from "@/lib/server/places";
import { SESSION_COOKIE, sessionSecret } from "@/lib/server/session";

export const metadata: Metadata = { title: "Ask Wally" };

export default function AskPage() {
  return (
    <Suspense fallback={<p className="p-8 text-ink-soft">Wally is on his way over…</p>}>
      <Ask />
    </Suspense>
  );
}

async function Ask() {
  // Read the cookie first: this is what makes the page render per request.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // Checking the session's expiry reads the clock, which needs a real request.
  await connection();
  const loaded = await loadAccount(token, sessionSecret());
  if (loaded.state === "upgrade") redirect("/api/session/upgrade");

  const retry = (
    <a href="/ask" className={noticeAction}>
      Try again
    </a>
  );
  if (loaded.state === "signed_out") {
    return (
      <Notice title="You’re not signed in." detail="Sign in to talk to Wally.">
        <Link href="/signin" className={noticeAction}>
          Sign in
        </Link>
      </Notice>
    );
  }
  if (loaded.state === "unavailable") {
    return (
      <Notice title="Wally can’t be reached right now." detail="His records didn’t respond. Nothing has been changed.">
        {retry}
      </Notice>
    );
  }
  // The conversation is kept with the account, so it needs the database.
  if (loaded.kept !== "database" || !loaded.account.id) {
    return <Notice title="Ask Wally isn’t switched on yet." detail="It needs Wally’s database, which isn’t connected." />;
  }

  let messages: ChatMessage[];
  try {
    messages = await loadMessages(loaded.account.id);
  } catch (error) {
    if (!(error instanceof DbError)) throw error;
    return (
      <Notice title="Your conversation can’t be loaded right now." detail="Wally’s records didn’t respond. Nothing has been changed.">
        {retry}
      </Notice>
    );
  }

  return (
    <>
      <SignedInHeader active="/ask" />
      <AskWally name={loaded.account.name} initial={messages} ready={agentConfigured()} places={placesConfigured()} address={loaded.account.address ?? null} />
    </>
  );
}
