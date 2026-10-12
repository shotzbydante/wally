/** Shapes shared by the chat API and the page. */

/** An option Wally offers. `reply` is what choosing it says back to him. */
export interface Choice {
  emoji: string;
  title: string;
  detail: string;
  reply: string;
  /** The place's own page, when the option is a real place Wally found on the web. */
  url?: string;
}

/** A web page Wally drew on for an answer. */
export interface Source {
  title: string;
  url: string;
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
  /** Wally has gone to look something up on the web. */
  | { type: "searching" }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; error: string };

export const MAX_MESSAGE_CHARS = 2000;

/**
 * A message as plain text, with any options as a numbered list. This is what
 * a text thread shows, and what Wally reads back as his own earlier turn.
 */
export function asPlainText(message: Pick<ChatMessage, "content" | "choices">): string {
  const list = (message.choices ?? []).map((c, i) => `${i + 1}. ${c.title}${c.detail ? `: ${c.detail}` : ""}${c.url ? ` ${c.url}` : ""}`);
  return [message.content, ...list].filter(Boolean).join("\n");
}

/**
 * Sources travel inside the message text, as a closing block:
 *
 *   Sources:
 *   Eater LA https://la.eater.com/…
 *
 * That way a text thread shows them as written, and the website lifts them
 * out and shows them as links.
 */
const SOURCES_MARK = "\n\nSources:\n";
const SOURCE_LINE = /^(.*?)\s*(https?:\/\/\S+)$/;

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export function withSources(text: string, sources: Source[]): string {
  if (sources.length === 0) return text;
  const lines = sources.map((s) => `${s.title.replace(/\s+/g, " ").trim().slice(0, 80)} ${s.url}`.trim());
  return `${text}${SOURCES_MARK}${lines.join("\n")}`;
}

export function splitSources(content: string): { text: string; sources: Source[] } {
  const at = content.lastIndexOf(SOURCES_MARK);
  if (at < 0) return { text: content, sources: [] };
  const sources: Source[] = [];
  for (const line of content.slice(at + SOURCES_MARK.length).split("\n")) {
    const match = SOURCE_LINE.exec(line.trim());
    // Anything that isn't a source line means this was ordinary prose after all.
    if (!match || !hostOf(match[2]!)) return { text: content, sources: [] };
    sources.push({ title: match[1]! || hostOf(match[2]!), url: match[2]! });
  }
  return { text: content.slice(0, at), sources };
}
