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
  /** Set when the card is an order ready to pay (see TicketInfo). */
  ticket?: TicketInfo;
}

/**
 * An order Wally built, ready for the person to pay on the restaurant's own
 * checkout page. Every figure comes from the restaurant's system, in cents.
 */
export interface TicketInfo {
  restaurant: string;
  address: string;
  item: string;
  variation: string;
  modifiers: string[];
  quantity: number;
  subtotal: number;
  tax: number;
  total: number;
  /** The restaurant's checkout page, where the person pays. */
  checkoutUrl: string;
}

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** The ticket as lines of text: "1 × Small Poke Bowl (White Rice, Salmon)", subtotal, tax, total. */
export function ticketLines(t: TicketInfo): string[] {
  const what = `${t.quantity} × ${t.item}${t.variation && t.variation !== "Regular" ? ` (${t.variation})` : ""}${t.modifiers.length ? ` with ${t.modifiers.join(", ")}` : ""}`;
  return [what, `Subtotal ${dollars(t.subtotal)}`, `Tax ${dollars(t.tax)}`, `Total ${dollars(t.total)}`, "Pickup. Pay on the restaurant's checkout page."];
}

/** What a card shows about a real place. Everything here comes from the places search, not from Wally's words. */
export interface PlaceInfo {
  /** Google's place ID. */
  id: string;
  /** Straight-line miles from the person's saved address, or from `from` when that is set. */
  miles?: number;
  /** Where `miles` is measured from when it isn't the saved address: the landmark, venue or area the person named ("Pantages Theatre"). */
  from?: string;
  /** How long it takes to get there from the same origin, by Google's routing: on foot around a named spot, by road otherwise. */
  travel?: { mode: "WALK" | "DRIVE"; minutes: number };
  /** Open when Wally answered. Only meaningful while the message is fresh. */
  open?: boolean;
  rating?: number;
  price?: string;
  website?: string;
  /** The place on Google Maps. */
  maps: string;
  /** Wally can build a pickup order here (see "Ordering" in CLAUDE.md). */
  orders?: boolean;
}

/** "6 min walk" or "12 min drive", or the straight-line miles when the search gave no travel time; with where it is from, when that isn't the saved address. */
export function howFar(p: Pick<PlaceInfo, "miles" | "from" | "travel"> | undefined): string | undefined {
  if (!p) return undefined;
  const how = p.travel ? `${p.travel.minutes} min ${p.travel.mode === "WALK" ? "walk" : "drive"}` : p.miles !== undefined ? `${p.miles} mi` : undefined;
  return how ? `${how}${p.from ? ` from ${p.from}` : ""}` : undefined;
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
    if (c.ticket) return `${i + 1}. Order at ${c.ticket.restaurant}: ${ticketLines(c.ticket).join("; ")} ${c.ticket.checkoutUrl}`;
    const facts = [howFar(c.place), c.place?.open === true && "open", c.place?.open === false && "closed", c.place?.orders && "order with Wally"].filter(Boolean);
    const link = c.place?.website ?? c.place?.maps ?? c.url;
    return `${i + 1}. ${c.title}${facts.length ? ` (${facts.join(", ")})` : ""}${c.detail ? `: ${c.detail}` : ""}${link ? ` ${link}` : ""}`;
  });
  return [message.content, ...list].filter(Boolean).join("\n");
}

/**
 * A link as a text thread shows it: "insomniacookies.com", not "https://insomniacookies.com/".
 * Phones still make it tappable. Anything with a query or fragment is left whole, since
 * those don't reliably become links without the scheme.
 */
export function tidyLink(url: string): string {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return url;
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
    if (u.search || u.hash || u.username) return u.href;
    return u.host.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "");
  } catch {
    return url;
  }
}

/**
 * A message as the texts Wally sends: his words in one bubble, then the
 * options in a second, each a small card of its own:
 *
 *   1. 🍪 Insomnia Cookies
 *   Open now · 2.8 mi · ★ 4.5
 *   Open late, warm cookies
 *   insomniacookies.com
 *
 * Numbers stay, because a person may answer with one. `asPlainText` remains
 * the record Wally reads back; this is only how it looks on a phone.
 *
 * A place's link is its website. Without one, the card offers the delivery
 * apps instead, as short links on `origin` (see `textDeliveryLinks`). A
 * Google Maps link is never sent. The options end with a link to `/ask`,
 * where the same conversation is waiting; `sayInSync` adds a line saying so.
 */
export function asTexts(message: Pick<ChatMessage, "content" | "choices">, origin: string, sayInSync = false): string[] {
  const cards = (message.choices ?? []).map((c, i) => {
    if (c.ticket) return [`${i + 1}. 🧾 ${c.ticket.restaurant}`, ...ticketLines(c.ticket), `Pay here: ${c.ticket.checkoutUrl}`].join("\n");
    const p = c.place;
    const facts = [
      p?.open === true && "Open now",
      p?.open === false && "Closed",
      howFar(p),
      p?.rating !== undefined && `★ ${p.rating.toFixed(1)}`,
      p?.price,
      p?.orders && "🧾 Order with Wally",
    ].filter(Boolean);
    const site = p ? p.website : c.url;
    const links = site ? [tidyLink(site)] : p ? textDeliveryLinks(c.title, origin).map((l) => `${l.app}: ${l.url}`) : [];
    return [`${i + 1}. ${c.emoji ? `${c.emoji} ` : ""}${c.title}`, facts.join(" · "), c.detail, ...links].filter(Boolean).join("\n");
  });
  // Every set of options closes with the way into the same conversation on the website.
  const more = `Visit Wally for more options: ${tidyLink(`${origin}/ask`)}${sayInSync ? "\nIt's this same conversation, always in sync with our texts." : ""}`;
  return [message.content.trim(), cards.length ? `${cards.join("\n\n")}\n\n${more}` : ""].filter(Boolean);
}

/** How long texting must have been quiet before Wally mentions the website again. */
const WEB_NUDGE_QUIET_DAYS = 7;

/**
 * Whether this answer should end with the pointer to the website: on Wally's
 * first text to someone, and again only after a week without texts from him.
 * `thread` is the conversation before this answer.
 */
export function webNudgeDue(thread: Pick<ChatMessage, "role" | "channel" | "created_at">[], now = Date.now()): boolean {
  const since = now - WEB_NUDGE_QUIET_DAYS * 86_400_000;
  return !thread.some((m) => m.role === "assistant" && m.channel === "text" && Date.parse(m.created_at) > since);
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
export function deliveryLinks(name: string, website?: string | null): { app: string; url: string }[] {
  const q = encodeURIComponent(name);
  // A listing whose own website is its page on the app: use that page. Neither app offers a lookup, and rule 8 rules out finding one any other way.
  const host = hostOf(website ?? "");
  const listed = (app: string) => (host === app || host.endsWith(`.${app}`)) && /\/store\//.test(website ?? "") ? website! : undefined;
  return [
    { app: "DoorDash", url: listed("doordash.com") ?? `https://www.doordash.com/search/store/${q}/` },
    { app: "Uber Eats", url: listed("ubereats.com") ?? `https://www.ubereats.com/search?q=${q}` },
  ];
}

/**
 * The same delivery searches as short links for a text, served by
 * `/go/[app]/[slug]`: "wallywaiter.com/go/doordash/tacos-el-parrillon".
 * Empty when the name has nothing a link can carry.
 */
export function textDeliveryLinks(name: string, origin: string): { app: string; url: string }[] {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['\u2019]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  if (!slug) return [];
  return deliveryLinks(name).map((l) => ({ app: l.app, url: tidyLink(`${origin}/go/${l.app.toLowerCase().replace(/\s/g, "")}/${slug}`) }));
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

/** What the address bar holds when the person chose to search near where their device is, not a typed address. */
export const CURRENT_LOCATION = "My current location";

/**
 * The city and state of a saved address ("Fresno, CA"), which is as much of it as Wally is told.
 * Undefined when the address doesn't read as street, city, state.
 */
export function cityOf(address: string | null | undefined): string | undefined {
  const parts = (address ?? "").replace(/,\s*(USA|United States)$/i, "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return undefined;
  const state = parts[parts.length - 1]!.replace(/\s*\d{5}(-\d{4})?$/, "");
  return [parts[parts.length - 2], state].filter(Boolean).join(", ").slice(0, 60);
}

/** How long after an answer its "open" and "closed" badges are still worth showing. */
export const OPEN_BADGE_MINUTES = 30;
