import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { EraseButton } from "@/components/EraseButton";
import { NameForm } from "@/components/NameForm";
import { Notice, noticeAction as primary } from "@/components/Notice";
import { SignedInHeader } from "@/components/SignedInHeader";
import { Wally } from "@/components/Wally";
import { delivery, reservations, type FoodService } from "@/lib/connectors";
import { loadAccount } from "@/lib/server/accounts";
import { SESSION_COOKIE, sessionSecret } from "@/lib/server/session";
import { firstTextLink, formatUsPhone } from "@/lib/signup";

export const metadata: Metadata = { title: "Your account" };

type Query = Promise<{ problem?: string | string[] }>;

export default function AccountPage({ searchParams }: { searchParams: Query }) {
  return (
    <Suspense fallback={<p className="p-8 text-ink-soft">Fetching your details…</p>}>
      <Account searchParams={searchParams} />
    </Suspense>
  );
}

async function Account({ searchParams }: { searchParams: Query }) {
  // Read the cookie first: this is what makes the page render per request.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // Checking the session's expiry reads the clock, which needs a real request.
  await connection();
  const loaded = await loadAccount(token, sessionSecret());
  // A cookie from before the database: turn it into an account, then come back.
  if (loaded.state === "upgrade") redirect("/api/session/upgrade");

  if (loaded.state === "unavailable") {
    return (
      <Notice title="Your account can’t be loaded right now." detail="Wally’s records didn’t respond. Nothing has been changed.">
        <a href="/account" className={primary}>
          Try again
        </a>
      </Notice>
    );
  }
  if (loaded.state === "signed_out") {
    return (
      <Notice title="You’re not signed in." detail="Sign in to see your account.">
        <Link href="/signin" className={primary}>
          Sign in
        </Link>
      </Notice>
    );
  }

  const session = loaded.account;
  const inDatabase = loaded.kept === "database";
  const eraseFailed = (await searchParams).problem === "erase";

  const wallyNumber = process.env.NEXT_PUBLIC_WALLY_NUMBER ?? null;

  return (
    <>
      <SignedInHeader active="/account" />

      <main className="mx-auto w-full max-w-[640px] flex-1 px-5 pt-6 pb-16 sm:px-8">
        {eraseFailed && (
          <p role="alert" className="mb-6 rounded-xl border border-red/40 bg-red/5 p-3 text-[0.95rem] font-medium text-red">
            Your account wasn’t erased. Wally’s records didn’t respond. Nothing was deleted. Try again in a moment.
          </p>
        )}
        <div className="flex items-center gap-4">
          <div className="wally-float w-24 shrink-0 sm:w-28">
            <Wally priority className="w-full" />
          </div>
          <div>
            <h1 className="font-display text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
              {session.name ? `Welcome in, ${session.name}.` : "Welcome in."}
            </h1>
            <p className="mt-1 text-ink-soft">Your account, and everywhere Wally can look for your next meal.</p>
          </div>
        </div>

        <Section title="Contact" subtitle="Ways to reach Wally directly">
          <Row
            icon={<Glyph>💬</Glyph>}
            title="Messages"
            detail={wallyNumber ? formatUsPhone(wallyNumber) : "Wally’s phone line isn’t open yet"}
            action={wallyNumber ? <Action href={firstTextLink(wallyNumber)}>Text Wally</Action> : <Soon>Not open yet</Soon>}
          />
        </Section>

        <Section title="Name" subtitle="What Wally calls you">
          <NameForm initial={session.name} />
        </Section>

        <Section title="Sign-in methods" subtitle="How you get into your account">
          <Row
            icon={<Glyph>📱</Glyph>}
            title="Phone"
            detail={session.phone ? `+1 ${formatUsPhone(session.phone)}` : "Not linked"}
            action={<Action href="/join?link=1" quiet>{session.phone ? "Change" : "Add"}</Action>}
          />
          <Row
            icon={<Glyph>@</Glyph>}
            title="Email"
            detail={session.email ?? "Not linked"}
            action={<Action href="/signin?link=1" quiet>{session.email ? "Change" : "Add"}</Action>}
          />
          <Row
            icon={<Glyph>G</Glyph>}
            title="Google"
            detail={session.google ? "Connected" : "Not connected"}
            action={session.google ? <Done>Connected</Done> : <Action href="/api/auth/google/start?link=1" external>Connect</Action>}
          />
        </Section>

        <Section title="This browser" subtitle="Signing out keeps your account and your conversation">
          <Row
            title="Signed in"
            detail={session.email ?? (session.phone ? `+1 ${formatUsPhone(session.phone)}` : "This browser")}
            action={
              <form action="/api/session/logout" method="post">
                <button type="submit" className="press h-11 rounded-xl bg-pad px-4 font-semibold ring-1 ring-line ring-inset hover:ring-ink">
                  Sign out
                </button>
              </form>
            }
          />
        </Section>

        <Section title="Restaurants direct" subtitle="Where Wally looks first">
          <Row
            icon={<Glyph>🏡</Glyph>}
            title="Restaurants’ own sites"
            detail="When a restaurant has its own site, Wally puts it ahead of the apps so you can order direct. Nothing to connect."
            action={<Done>On</Done>}
          />
        </Section>

        <Section title="Delivery apps" subtitle="More places Wally can order from for you">
          {delivery.map((s) => (
            <ServiceRow key={s.name} service={s} />
          ))}
        </Section>

        <Section title="Reservations" subtitle="Where Wally can book tables for you">
          {reservations.map((s) => (
            <ServiceRow key={s.name} service={s} />
          ))}
        </Section>

        <Section title="Data privacy" subtitle="What Wally keeps about you">
          {inDatabase ? (
            // Stacked on phones: two buttons beside the text leave it no room.
            <div className="py-4 sm:flex sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Your details</p>
                <p className="text-[0.95rem] text-ink-soft">
                  Wally keeps your name, the sign-in methods above, your saved address and your conversation with him, so
                  they are here on any device you sign in from. Erasing deletes all of it for good.
                </p>
              </div>
              <div className="mt-3 sm:mt-0 sm:shrink-0">
                <EraseButton />
              </div>
            </div>
          ) : (
            <Row
              title="Your details"
              detail="For now, everything on this page is stored only in this browser. Signing out erases it."
              action={
                <form action="/api/session/logout" method="post">
                  <button
                    type="submit"
                    className="press h-11 rounded-xl border border-red/50 px-4 font-semibold text-red hover:bg-red/5"
                  >
                    Sign out and erase
                  </button>
                </form>
              }
            />
          )}
        </Section>
      </main>
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-[1.6rem] font-bold tracking-[-0.02em]">{title}</h2>
      <p className="mt-0.5 text-ink-soft">{subtitle}</p>
      <div className="mt-4 divide-y divide-line border-t-2 border-ink">{children}</div>
    </section>
  );
}

function Row({ icon, title, detail, action }: { icon?: ReactNode; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-4">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-[0.95rem] break-words text-ink-soft">{detail}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function ServiceRow({ service }: { service: FoodService }) {
  return (
    <Row
      icon={<Glyph>{service.name.charAt(0)}</Glyph>}
      title={service.name}
      detail={service.blurb}
      action={<Soon>Coming soon</Soon>}
    />
  );
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-wash text-[1.15rem] font-bold text-green-deep"
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function Action({ href, children, quiet = false, external = false }: { href: string; children: ReactNode; quiet?: boolean; external?: boolean }) {
  const cls = `press inline-flex h-11 items-center rounded-xl px-4 font-semibold ${
    quiet ? "bg-pad ring-1 ring-line ring-inset hover:ring-ink" : "bg-ink text-white hover:bg-green-deep"
  }`;
  // Route handlers and sms: links need a plain anchor, not client navigation.
  return external || !href.startsWith("/") ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

function Soon({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-9 items-center rounded-full bg-line/70 px-3.5 text-[0.9rem] font-semibold text-ink-soft">{children}</span>;
}

function Done({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-9 items-center rounded-full bg-mint-wash px-3.5 text-[0.9rem] font-semibold text-green-deep">{children}</span>;
}
