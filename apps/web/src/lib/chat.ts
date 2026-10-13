/** Shapes shared by the chat API and the page. */

/** An option Wally offers. `reply` is what choosing it says back to him. */
export interface Choice {
  emoji: string;
  title: string;
  detail: string;
  reply: string;
  /** The place's own page, when the option is a real place Wally found on the web. */
  url?: string;
  /** Set when the option is a real place from the places search. */
  place?: PlaceInfo;
}

/** What a card shows about a real place. Everything here comes from the places search, not from Wally's words. */
export interface PlaceInfo {
  /** Google's place ID. */
  id: string;
  /** Straight-line miles from the person's saved address. */
  miles?: number;
  /** Open when Wally answered. Only meaningful while the message is fresh. */
  open?: boolean;
  rating?: number;
  price?: string;
  website?: string;
  /** The place on Google Maps. */
  maps: string;
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
  const list = (message.choices ?? []).map((c, i) => {
    const facts = [c.place?.miles !== undefined && `${c.place.miles} mi`, c.place?.open === true && "open", c.place?.open === false && "closed"].filter(Boolean);
    const link = c.place?.website ?? c.place?.maps ?? c.url;
    return `${i + 1}. ${c.title}${facts.length ? ` (${facts.join(", ")})` : ""}${c.detail ? `: ${c.detail}` : ""}${link ? ` ${link}` : ""}`;
  });
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

/**
 * Links that open a search for the restaurant in each delivery app. They
 * are searches, not the restaurant's own page there: no app offers a
 * sanctioned way to look that up, and Wally doesn't scrape them (rule 8).
 */
export function deliveryLinks(name: string): { app: string; url: string }[] {
  const q = encodeURIComponent(name);
  return [
    { app: "DoorDash", url: `https://www.doordash.com/search/store/${q}/` },
    { app: "Uber Eats", url: `https://www.ubereats.com/search?q=${q}` },
  ];
}

/**
 * Sites that list many restaurants, or host a page for one. A link to any of
 * them is not the restaurant's own site, so a card doesn't present it as one.
 */
const NOT_THEIR_OWN = [
  "doordash.com", "ubereats.com", "grubhub.com", "postmates.com", "seamless.com", "trycaviar.com", "instacart.com",
  "opentable.com", "resy.com", "exploretock.com", "yelp.com", "tripadvisor.com", "google.com", "goo.gl",
  "facebook.com", "instagram.com", "linktr.ee",
];

/** True when the link is the restaurant's own site rather than its page on a marketplace or social network. */
export function isOwnSite(url: string | undefined | null): boolean {
  const host = url ? hostOf(url) : "";
  return Boolean(host) && !NOT_THEIR_OWN.some((site) => host === site || host.endsWith(`.${site}`));
}

/** How long after an answer its "open" and "closed" badges are still worth showing. */
export const OPEN_BADGE_MINUTES = 30;
