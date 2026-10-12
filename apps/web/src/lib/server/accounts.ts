import { createHash } from "node:crypto";
import type { NextResponse } from "next/server";
import { DbError, dbConfigured, rpc } from "./db";
import { decodeSession, sessionFromRequest, setSession, startSession, type Session } from "./session";

/**
 * Accounts live in the database (supabase/migrations). The session cookie
 * holds only the account id. Without SUPABASE_URL and a key, the app falls
 * back to keeping the profile in the cookie, one browser at a time.
 */
export interface Account {
  id?: string;
  name: string;
  email?: string;
  google?: boolean;
  phone?: string;
  zip?: string;
  suggestions?: boolean;
}

/** What a completed sign-in proved, plus anything typed during sign-up. */
export interface Identity {
  email?: string;
  google?: boolean;
  phone?: string;
  name?: string;
  zip?: string;
  suggestions?: boolean;
}

interface Row {
  id: string;
  name: string;
  email: string | null;
  google: boolean;
  phone: string | null;
  zip: string | null;
  suggestions: boolean;
}

const fromRow = (row: Row): Account => ({
  id: row.id,
  name: row.name,
  email: row.email ?? undefined,
  google: row.google,
  phone: row.phone ?? undefined,
  zip: row.zip ?? undefined,
  suggestions: row.suggestions,
});

function signInRow(identity: Identity, link: string | null, typed: boolean): Promise<Row> {
  return rpc<Row>("wally_sign_in", {
    p_link: link,
    p_email: identity.email ?? null,
    p_google: identity.google ?? false,
    p_phone: identity.phone ?? null,
    p_name: identity.name ?? null,
    p_zip: identity.zip ?? null,
    p_suggestions: identity.suggestions ?? null,
    p_typed: typed,
  });
}

export interface SignInOptions {
  /** Add this email or phone to the account already signed in, instead of switching accounts. */
  link?: boolean;
  /** Add it to this account id (carried by an emailed link). */
  linkTo?: string;
  /** Name, ZIP and suggestions were typed by the person, so they replace what is stored. */
  typed?: boolean;
}

/**
 * Finishes a sign-in: finds or creates the account and sets the session
 * cookie on `res`. False means the database couldn't be reached and nothing
 * was changed.
 */
export async function signIn(
  res: NextResponse,
  request: Request,
  identity: Identity,
  secret: string,
  options: SignInOptions = {},
): Promise<boolean> {
  const current = sessionFromRequest(request, secret);
  if (!dbConfigured()) {
    setSession(res, current, identity, secret);
    return true;
  }
  const link = options.linkTo ?? (options.link ? current?.id : undefined) ?? null;
  try {
    const row = await signInRow(identity, link, options.typed === true);
    startSession(res, row.id, secret);
    return true;
  } catch (error) {
    if (error instanceof DbError) return false;
    throw error;
  }
}

/**
 * Moves a profile kept in the cookie (from before there was a database)
 * into an account. The cookie is signed, so its email and phone were verified.
 */
export async function upgradeSession(res: NextResponse, session: Session, secret: string): Promise<"ok" | "nothing" | "unavailable"> {
  if (!session.email && !session.phone) return "nothing";
  const profile = { name: session.name, zip: session.zip, suggestions: session.suggestions };
  try {
    let row: Row | null = null;
    if (session.email) row = await signInRow({ ...profile, email: session.email, google: session.google }, null, false);
    if (session.phone) row = await signInRow({ ...profile, phone: session.phone }, row?.id ?? null, false);
    startSession(res, row!.id, secret);
    return "ok";
  } catch (error) {
    if (error instanceof DbError) return "unavailable";
    throw error;
  }
}

export type AccountState =
  | { state: "signed_out" }
  /** `kept` says where the details live, for the privacy note. */
  | { state: "ok"; account: Account; kept: "database" | "browser" }
  /** A cookie from before the database: send it through /api/session/upgrade. */
  | { state: "upgrade" }
  | { state: "unavailable" };

/** The signed-in account for a session cookie value. */
export async function loadAccount(token: string | undefined, secret: string | null): Promise<AccountState> {
  const session = secret ? decodeSession(token, secret) : null;
  if (!session) return { state: "signed_out" };
  if (!dbConfigured()) return { state: "ok", account: session, kept: "browser" };
  if (!session.id) return { state: "upgrade" };
  try {
    const [row] = await rpc<Row[]>("wally_account", { p_id: session.id });
    // No row: the account was erased from another device.
    return row ? { state: "ok", account: fromRow(row), kept: "database" } : { state: "signed_out" };
  } catch (error) {
    if (error instanceof DbError) return { state: "unavailable" };
    throw error;
  }
}

/** Null if the account no longer exists. Throws DbError if the database can't be reached. */
export async function setAccountName(id: string, name: string): Promise<Account | null> {
  const [row] = await rpc<Row[]>("wally_set_name", { p_id: id, p_name: name });
  return row ? fromRow(row) : null;
}

/** Throws DbError if the database can't be reached. */
export async function deleteAccount(id: string): Promise<void> {
  await rpc<boolean>("wally_delete_account", { p_id: id });
}

/**
 * Marks an emailed sign-in link as opened. False if it was opened before.
 * Without a database links can't be tracked, so they work until they expire.
 */
export async function claimSignInLink(token: string, exp: number): Promise<boolean> {
  if (!dbConfigured()) return true;
  return rpc<boolean>("wally_use_link", {
    p_token_hash: createHash("sha256").update(token).digest("hex"),
    p_expires_at: new Date(exp * 1000).toISOString(),
  });
}
