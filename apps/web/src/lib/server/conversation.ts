import type { ChatMessage, Choice } from "@/lib/chat";
import { accountFromRow, type Account, type AccountRow } from "./accounts";
import { rpc } from "./db";

/**
 * The stored conversation: one thread per account, shared by every channel
 * (supabase/migrations/20261012000000_messages.sql). All of these throw
 * DbError if the database can't be reached.
 */
export type Channel = "web" | "text";

/** How much of the thread Wally reads before answering. */
const HISTORY_FOR_WALLY = 40;
/** How much of the thread the page shows. */
const HISTORY_ON_PAGE = 200;

export function dailyMessageLimit(): number {
  const n = Number(process.env.WALLY_DAILY_MESSAGES);
  return Number.isInteger(n) && n > 0 ? n : 100;
}

export const loadMessages = (account: string) =>
  rpc<ChatMessage[]>("wally_messages", { p_account: account, p_limit: HISTORY_ON_PAGE });

export type Begun = { status: "ok"; id: number; messages: ChatMessage[] } | { status: "limited" } | { status: "gone" };

/** Records what the person said and returns the recent thread, their message last. */
export const beginTurn = (account: string, channel: Channel, content: string) =>
  rpc<Begun>("wally_chat_begin", {
    p_account: account,
    p_channel: channel,
    p_content: content,
    p_daily_limit: dailyMessageLimit(),
    p_history: HISTORY_FOR_WALLY,
  });

export type TextBegun =
  | { status: "ok"; id: number; first: boolean; account: Account & { id: string }; messages: ChatMessage[] }
  | { status: "unknown" | "duplicate" | "stopped" | "limited" };

/**
 * Records a text and returns the thread, matched to an account by the
 * 10-digit number it came from. `external` is the provider's id for the
 * delivery, so a retried delivery is recognised and dropped.
 */
export async function beginTextTurn(phone: string, content: string, external: string | null): Promise<TextBegun> {
  const begun = await rpc<{ status: "ok"; id: number; first: boolean; account: AccountRow; messages: ChatMessage[] } | { status: "unknown" | "duplicate" | "stopped" | "limited" }>(
    "wally_text_begin",
    { p_phone: phone, p_content: content, p_external: external, p_daily_limit: dailyMessageLimit(), p_history: HISTORY_FOR_WALLY },
  );
  return begun.status === "ok" ? { ...begun, account: { ...accountFromRow(begun.account), id: begun.account.id } } : begun;
}

/** STOP (true) and START (false). False if no account has the number. */
export const setTextStopped = (phone: string, stopped: boolean) => rpc<boolean>("wally_text_stop", { p_phone: phone, p_stopped: stopped });

/** Records Wally's answer. Null if the account was erased meanwhile. */
export const saveReply = (account: string, channel: Channel, content: string, choices: Choice[] | null) =>
  rpc<ChatMessage | null>("wally_chat_reply", { p_account: account, p_channel: channel, p_content: content, p_choices: choices });

/** Takes back a message Wally couldn't answer, so it can be sent again. */
export const undoTurn = (account: string, id: number) => rpc<null>("wally_chat_undo", { p_account: account, p_id: id });

export const clearMessages = (account: string) => rpc<number>("wally_clear_messages", { p_account: account });
