/** Shapes shared by the chat API and the page. */

/** An option Wally offers. `reply` is what choosing it says back to him. */
export interface Choice {
  emoji: string;
  title: string;
  detail: string;
  reply: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  /** Where it was said: the website or a text thread. */
  channel: "web" | "text";
  content: string;
  choices: Choice[] | null;
  created_at: string;
}

/** One line of the streamed reply from POST /api/chat. */
export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; error: string };

export const MAX_MESSAGE_CHARS = 2000;

/**
 * A message as plain text, with any options as a numbered list. This is what
 * a text thread shows, and what Wally reads back as his own earlier turn.
 */
export function asPlainText(message: Pick<ChatMessage, "content" | "choices">): string {
  const list = (message.choices ?? []).map((c, i) => `${i + 1}. ${c.title}${c.detail ? `: ${c.detail}` : ""}`);
  return [message.content, ...list].filter(Boolean).join("\n");
}
