import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { Wally } from "@/components/Wally";
import { SESSION_COOKIE, decodeSession, sessionSecret } from "@/lib/server/session";
import { formatUsPhone } from "@/lib/signup";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-5 py-8 sm:px-8 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-12">
      <div className="wally-float mx-auto w-[40%] max-w-[200px] min-[900px]:w-[360px] min-[900px]:max-w-none min-[900px]:shrink-0">
        <Wally priority className="w-full" />
      </div>
      <div className="mt-4 min-[900px]:mt-0 min-[900px]:flex-1">
        <Suspense fallback={<p className="text-ink-soft">Fetching your details…</p>}>
          <Account />
        </Suspense>
      </div>
    </main>
  );
}

async function Account() {
  // Read the cookie first: this is what makes the page render per request.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const secret = sessionSecret();
  const session = secret ? decodeSession(token, secret) : null;

  if (!session) {
    return (
      <div>
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em]">You’re not signed in.</h1>
        <p className="mt-3 max-w-[30rem] text-lg text-ink-soft">
          Verify your mobile number to open your account. It takes about a minute.
        </p>
        <Link
          href="/join"
          className="press mt-6 inline-flex h-14 items-center rounded-full bg-green px-8 font-display text-[1.125rem] font-semibold text-white hover:bg-green-deep"
        >
          Verify my number
        </Link>
      </div>
    );
  }

  const rows: [string, string][] = [
    ["Name", session.name],
    ["Mobile", `${formatUsPhone(session.phone)} (verified)`],
    ["ZIP", session.zip],
    ["Suggestions", session.suggestions ? "On" : "Off"],
  ];

  return (
    <div className="max-w-[460px]">
      <h1 className="font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">Welcome in, {session.name}.</h1>
      <p className="mt-3 text-lg text-ink-soft">Here is what Wally has on his pad for you.</p>
      <dl className="mt-6 rounded-[1.25rem] bg-pad px-6 py-3 shadow-[0_1px_0_var(--line),0_18px_40px_-18px_rgba(22,26,43,0.28)]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-3 border-b border-line py-3 last:border-0">
            <dt className="w-28 shrink-0 text-[0.95rem] text-ink-soft">{label}</dt>
            <dd className="text-[1.05rem] font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-[0.95rem] text-ink-soft">
        Ordering, cards and limits will appear here as they are built. For now your account is kept on this device.
      </p>
      <form action="/api/session/logout" method="post" className="mt-5">
        <button type="submit" className="font-medium text-green underline-offset-4 hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
