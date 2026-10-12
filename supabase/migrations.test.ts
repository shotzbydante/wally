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
  await db.exec("reset role; truncate public.accounts, public.used_sign_in_links cascade; set role service_role;");
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

interface Message {
  id: number;
  role: "user" | "assistant";
  channel: "web" | "text";
  content: string;
  choices: unknown[] | null;
}
type Begin = { status: "ok"; id: number; messages: Message[] } | { status: "limited" } | { status: "gone" };

describe("conversation", () => {
  const one = async <T>(sql: string, params: unknown[]) => (await db.query<{ v: T }>(sql, params)).rows[0]!.v;
  const begin = (account: string, content: string, channel = "web", limit = 100, history = 40) =>
    one<Begin>("select public.wally_chat_begin($1, $2, $3, $4, $5) as v", [account, channel, content, limit, history]);
  const reply = (account: string, content: string, choices: unknown[] | null = null, channel = "web") =>
    one<Message | null>("select public.wally_chat_reply($1, $2, $3, $4) as v", [account, channel, content, choices && JSON.stringify(choices)]);
  const thread = (account: string, limit = 40) => one<Message[]>("select public.wally_messages($1, $2) as v", [account, limit]);

  it("keeps one thread per account, in order, across web and text", async () => {
    const a = await signIn({ email: "a@example.com" });
    const b = await signIn({ email: "b@example.com" });
    const first = await begin(a.id, "What should I eat?");
    expect(first).toMatchObject({ status: "ok", messages: [{ role: "user", content: "What should I eat?", channel: "web" }] });
    const choices = [{ emoji: "🍜", title: "Ramen", detail: "Rich and warm", reply: "Ramen" }];
    expect(await reply(a.id, "Two ideas.", choices)).toMatchObject({ role: "assistant", content: "Two ideas.", choices });
    await begin(a.id, "Ramen", "text");
    await begin(b.id, "Hello");
    expect((await thread(a.id)).map((m) => [m.role, m.channel, m.content])).toEqual([
      ["user", "web", "What should I eat?"],
      ["assistant", "web", "Two ideas."],
      ["user", "text", "Ramen"],
    ]);
    expect(await thread(b.id)).toHaveLength(1);
    expect(JSON.stringify(await thread(a.id))).not.toContain("account_id");
  });

  it("hands Wally only the most recent messages", async () => {
    const a = await signIn({ email: "a@example.com" });
    for (const text of ["one", "two", "three"]) await begin(a.id, text);
    const last = await begin(a.id, "four", "web", 100, 2);
    expect(last.status === "ok" && last.messages.map((m) => m.content)).toEqual(["three", "four"]);
  });

  it("stops at the daily limit without storing the message", async () => {
    const a = await signIn({ email: "a@example.com" });
    await begin(a.id, "one", "web", 2);
    await reply(a.id, "Certainly.");
    await begin(a.id, "two", "web", 2);
    expect(await begin(a.id, "three", "web", 2)).toEqual({ status: "limited" });
    expect(await thread(a.id)).toHaveLength(3);
  });

  it("takes back a message Wally could not answer, and only the person's own", async () => {
    const a = await signIn({ email: "a@example.com" });
    const b = await signIn({ email: "b@example.com" });
    const sent = await begin(a.id, "hello");
    const answer = await reply(a.id, "Good evening.");
    if (sent.status !== "ok") throw new Error("expected ok");
    await db.query("select public.wally_chat_undo($1, $2)", [b.id, sent.id]);
    await db.query("select public.wally_chat_undo($1, $2)", [a.id, answer!.id]);
    expect(await thread(a.id)).toHaveLength(2);
    await db.query("select public.wally_chat_undo($1, $2)", [a.id, sent.id]);
    expect((await thread(a.id)).map((m) => m.content)).toEqual(["Good evening."]);
  });

  it("refuses an empty message, and one for an erased account", async () => {
    const a = await signIn({ email: "a@example.com" });
    await expect(begin(a.id, "")).rejects.toThrow(/messages_not_empty/);
    await db.query("select public.wally_delete_account($1)", [a.id]);
    expect(await begin(a.id, "hello")).toEqual({ status: "gone" });
    expect(await reply(a.id, "hello")).toBeNull();
  });

  it("clears a thread, and erasing the account erases it too", async () => {
    const a = await signIn({ email: "a@example.com" });
    const b = await signIn({ email: "b@example.com" });
    await begin(a.id, "one");
    await begin(a.id, "two");
    await begin(b.id, "three");
    expect(await one<number>("select public.wally_clear_messages($1) as v", [a.id])).toBe(2);
    expect(await thread(a.id)).toEqual([]);
    await db.query("select public.wally_delete_account($1)", [b.id]);
    await db.exec("reset role");
    expect(await one<number>("select count(*)::int as v from public.messages", [])).toBe(0);
  });

  it("carries the conversation across when one account is folded into another", async () => {
    const byPhone = await signIn({ phone: "3105550142", name: "Ana", typed: true });
    const byEmail = await signIn({ email: "a@example.com" });
    await begin(byPhone.id, "by text", "text");
    await begin(byEmail.id, "on the web");
    await signIn({ link: byEmail.id, phone: "3105550142" });
    expect((await thread(byEmail.id)).map((m) => m.content)).toEqual(["by text", "on the web"]);
  });
});

describe("address", () => {
  const set = (id: string, address: string | null, lat: number | null, lng: number | null) =>
    db.query<Account & { address: string | null; lat: number | null; lng: number | null }>("select * from public.wally_set_address($1, $2, $3, $4)", [id, address, lat, lng]);

  it("saves, replaces and clears an address", async () => {
    const a = await signIn({ email: "a@example.com" });
    expect((await set(a.id, "5905 Wilshire Blvd, Los Angeles", 34.0639, -118.3592)).rows[0]).toMatchObject({ address: "5905 Wilshire Blvd, Los Angeles", lat: 34.0639, lng: -118.3592 });
    expect(await get(a.id)).toMatchObject({ address: "5905 Wilshire Blvd, Los Angeles" });
    expect((await set(a.id, null, null, null)).rows[0]).toMatchObject({ address: null, lat: null, lng: null });
  });

  it("refuses half an address, or coordinates off the map", async () => {
    const a = await signIn({ email: "a@example.com" });
    await expect(set(a.id, "Somewhere", null, null)).rejects.toThrow(/accounts_address_whole/);
    await expect(set(a.id, "Somewhere", 134, -118)).rejects.toThrow(/lat/);
  });

  it("changes nothing for an account that is gone", async () => {
    expect((await set("00000000-0000-0000-0000-000000000000", "Somewhere", 34, -118)).rows).toEqual([]);
  });
});

describe("access", () => {
  it.each(["anon", "authenticated"])("is closed to the %s role, which the publishable key maps to", async (role) => {
    await db.exec("reset role");
    await db.query("select * from public.wally_sign_in(null, 'a@example.com', false, null, null, null, null, false)");
    await db.exec(`set role ${role}`);
    await expect(db.query("select * from public.accounts")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.wally_account(gen_random_uuid())")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.messages")).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.wally_messages(gen_random_uuid(), 10)")).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.wally_chat_begin(gen_random_uuid(), 'web', 'hi', 100, 40)")).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.wally_clear_messages(gen_random_uuid())")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.wally_set_address(gen_random_uuid(), 'x', 1, 1)")).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select * from public.wally_sign_in(null, 'x@example.com', false, null, null, null, null, false)"),
    ).rejects.toThrow(/permission denied/);
  });
});
