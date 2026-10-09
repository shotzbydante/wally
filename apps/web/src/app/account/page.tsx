import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NameForm } from "@/components/NameForm";
import { SiteHeader } from "@/components/SiteHeader";
import { Wally } from "@/components/Wally";
import { delivery, reservations, type FoodService } from "@/lib/connectors";
import { SESSION_COOKIE, decodeSession, sessionSecret } from "@/lib/server/session";
import { firstTextLink, formatUsPhone } from "@/lib/signup";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="p-8 text-ink-soft">Fetching your details…</p>}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  // Read the cookie first: this is what makes the page render per request.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const secret = sessionSecret();
  const session = secret ? decodeSession(token, secret) : null;

  if (!session) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-start justify-center px-5 py-10 sm:px-8">
          <div className="wally-float w-36">
            <Wally priority className="w-full" />
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-[-0.02em]">You’re not signed in.</h1>
          <p className="mt-3 text-lg text-ink-soft">Sign in to see your account.</p>
          <Link
            href="/signin"
            className="press mt-6 inline-flex h-14 items-center rounded-full bg-green px-8 text-[1.125rem] font-semibold text-white hover:bg-green-deep"
          >
            Sign in
          </Link>
        </main>
      </>
    );
  }

  const wallyNumber = process.env.NEXT_PUBLIC_WALLY_NUMBER ?? null;

  return (
    <>
      <SiteHeader>
        <form action="/api/session/logout" method="post">
          <button type="submit" className="text-green underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </SiteHeader>

      <main className="mx-auto w-full max-w-[640px] flex-1 px-5 pt-6 pb-16 sm:px-8">
        <div className="flex items-center gap-4">
          <div className="wally-float w-24 shrink-0 sm:w-28">
            <Wally priority className="w-full" />
          </div>
          <div>
            <h1 className="font-display text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
              {session.name ? `Welcome in, ${session.name}.` : "Welcome in."}
            </h1>
            <p className="mt-1 text-ink-soft">Your account, and how Wally reaches the places you eat.</p>
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
            action={<Action href="/join" quiet>{session.phone ? "Change" : "Add"}</Action>}
          />
          <Row
            icon={<Glyph>@</Glyph>}
            title="Email"
            detail={session.email ?? "Not linked"}
            action={<Action href="/signin" quiet>{session.email ? "Change" : "Add"}</Action>}
          />
          <Row
            icon={<Glyph>G</Glyph>}
            title="Google"
            detail={session.google ? "Connected" : "Not connected"}
            action={session.google ? <Done>Connected</Done> : <Action href="/api/auth/google/start" external>Connect</Action>}
          />
        </Section>

        <Section title="Delivery apps" subtitle="Where Wally can order from for you">
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
