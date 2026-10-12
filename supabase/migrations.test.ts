import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Runs the real migrations in an in-process Postgres, set up with the roles
 * and permissive default grants a Supabase project has.
 */
const dir = join(__dirname, "migrations");
const migrations = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(dir, f), "utf8"));

interface Account {
  id: string;
  name: string;
  email: string | null;
  google: boolean;
  phone: string | null;
  zip: string | null;
  suggestions: boolean;
}

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  for (const sql of migrations) await db.exec(sql);
}, 30_000);

beforeEach(async () => {
  await db.exec("reset role; truncate public.accounts, public.used_sign_in_links; set role service_role;");
});

interface SignIn {
  link?: string;
  email?: string;
  google?: boolean;
  phone?: string;
  name?: string;
  zip?: string;
  suggestions?: boolean;
  typed?: boolean;
}

async function signIn(a: SignIn): Promise<Account> {
  const { rows } = await db.query<Account>("select * from public.wally_sign_in($1, $2, $3, $4, $5, $6, $7, $8)", [
    a.link ?? null,
    a.email ?? null,
    a.google ?? false,
    a.phone ?? null,
    a.name ?? null,
    a.zip ?? null,
    a.suggestions ?? null,
    a.typed ?? false,
  ]);
  return rows[0]!;
}

const count = async () => (await db.query<{ n: number }>("select count(*)::int as n from public.accounts")).rows[0]!.n;
const get = async (id: string) => (await db.query<Account>("select * from public.wally_account($1)", [id])).rows[0];

describe("wally_sign_in", () => {
  it("creates an account once and finds it again from any device", async () => {
    const first = await signIn({ email: "dante@example.com", google: true, name: "Dante" });
    const again = await signIn({ email: "dante@example.com", google: true, name: "Dante" });
    expect(again.id).toBe(first.id);
    expect(again).toMatchObject({ name: "Dante", email: "dante@example.com", google: true, phone: null });
    expect(await count()).toBe(1);
  });

  it("keeps a name the person chose when Google signs them in again", async () => {
    const a = await signIn({ email: "dante@example.com", google: true, name: "Dante" });
    await db.query("select * from public.wally_set_name($1, $2)", [a.id, "D"]);
    expect((await signIn({ email: "dante@example.com", google: true, name: "Dante" })).name).toBe("D");
  });

  it("keeps two people apart when the second signs in without linking", async () => {
    const a = await signIn({ email: "a@example.com", name: "Ana" });
    const b = await signIn({ email: "b@example.com", name: "Ben" });
    expect(b.id).not.toBe(a.id);
    expect(await get(a.id)).toMatchObject({ email: "a@example.com", name: "Ana" });
  });

  it("adds a phone to the linked account", async () => {
    const a = await signIn({ email: "a@example.com", google: true, name: "Ana" });
    const linked = await signIn({ link: a.id, phone: "3105550142", name: "Ana", zip: "90026", suggestions: true, typed: true });
    expect(linked).toMatchObject({ id: a.id, email: "a@example.com", google: true, phone: "3105550142", zip: "90026", suggestions: true });
    expect((await signIn({ phone: "3105550142" })).id).toBe(a.id);
  });

  it("folds an account that already owns the phone into the linked one", async () => {
    const byPhone = await signIn({ phone: "3105550142", name: "Ana", zip: "90026", typed: true });
    const byEmail = await signIn({ email: "a@example.com", google: true });
    const linked = await signIn({ link: byEmail.id, phone: "3105550142" });
    expect(linked).toMatchObject({ id: byEmail.id, name: "Ana", email: "a@example.com", google: true, phone: "3105550142", zip: "90026" });
    expect(await get(byPhone.id)).toBeUndefined();
    expect(await count()).toBe(1);
  });

  it("drops the Google mark when the email is changed by link", async () => {
    const a = await signIn({ email: "a@example.com", google: true });
    const changed = await signIn({ link: a.id, email: "new@example.com" });
    expect(changed).toMatchObject({ id: a.id, email: "new@example.com", google: false });
    expect((await signIn({ email: "a@example.com" })).id).not.toBe(a.id);
  });

  it("signs in plainly when the account to link to is gone", async () => {
    const a = await signIn({ email: "a@example.com" });
    await db.query("select public.wally_delete_account($1)", [a.id]);
    const b = await signIn({ link: a.id, email: "b@example.com" });
    expect(b).toMatchObject({ email: "b@example.com" });
    expect(await count()).toBe(1);
  });

  it("lets typed sign-up details replace stored ones, and nothing else", async () => {
    const a = await signIn({ phone: "3105550142", name: "Ana", zip: "90026", typed: true });
    expect(await signIn({ phone: "3105550142", name: "Anna", zip: "93721", typed: true })).toMatchObject({ id: a.id, name: "Anna", zip: "93721" });
    expect(await signIn({ phone: "3105550142", name: "Other", zip: "10001" })).toMatchObject({ name: "Anna", zip: "93721" });
  });

  it("refuses a call with both an email and a phone, or neither", async () => {
    await expect(signIn({ email: "a@example.com", phone: "3105550142" })).rejects.toThrow(/exactly one/);
    await expect(signIn({})).rejects.toThrow(/exactly one/);
  });
});

describe("account functions", () => {
  it("erases an account", async () => {
    const a = await signIn({ email: "a@example.com" });
    const erase = () => db.query<{ gone: boolean }>("select public.wally_delete_account($1) as gone", [a.id]);
    expect((await erase()).rows[0]!.gone).toBe(true);
    expect(await get(a.id)).toBeUndefined();
    expect((await erase()).rows[0]!.gone).toBe(false);
  });

  it("lets a sign-in link be used once", async () => {
    const use = async (hash: string) =>
      (await db.query<{ ok: boolean }>("select public.wally_use_link($1, now() + interval '15 minutes') as ok", [hash])).rows[0]!.ok;
    expect(await use("abc")).toBe(true);
    expect(await use("abc")).toBe(false);
    expect(await use("def")).toBe(true);
  });
});

describe("access", () => {
  it.each(["anon", "authenticated"])("is closed to the %s role, which the publishable key maps to", async (role) => {
    await db.exec("reset role");
    await db.query("select * from public.wally_sign_in(null, 'a@example.com', false, null, null, null, null, false)");
    await db.exec(`set role ${role}`);
    await expect(db.query("select * from public.accounts")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.wally_account(gen_random_uuid())")).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select * from public.wally_sign_in(null, 'x@example.com', false, null, null, null, null, false)"),
    ).rejects.toThrow(/permission denied/);
  });
});
