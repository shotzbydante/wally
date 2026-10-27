/**
 * Reads a restaurant's menu from its own website, so Wally can answer "what do
 * they have" and "what's in the X" even where he can't build the order.
 *
 * What this reads, and what it never reads (rule 8): only the restaurant's own
 * site, the one its Google listing points to and `isOwnSite` accepts, and
 * never a delivery app, a marketplace, or an ordering platform's hosted page
 * (`PLATFORM_HOSTS`), whose terms forbid automated reading. It fetches as a
 * browser would for one person's question: a handful of pages, once, with
 * its name in the User-Agent, after checking robots.txt, and keeps nothing
 * beyond the turn. Structured data the site publishes for exactly this
 * (schema.org Menu / MenuItem in JSON-LD) is preferred; otherwise the page's
 * readable text, trimmed to the parts that look like a menu.
 */
import { hostOf, isOwnSite } from "@/lib/chat";

export const USER_AGENT = "WallyBot/1.0 (+https://www.wallywaiter.com)";

/** Ordering platforms that host a restaurant's page: not the restaurant's own site, and their terms bar automated reading. */
const PLATFORM_HOSTS = ["toasttab.com", "square.site", "squareup.com", "chownow.com", "slicelife.com", "clover.com", "ezcater.com", "order.online", "ordering.app", "menufy.com", "owner.com", "spoton.com", "bentobox.com", "getbento.com"];

/** Pages, bytes and characters a read may take: enough for a menu, not a crawl. */
const MAX_PAGES = 4;
const MAX_BYTES = 1_500_000;
const MAX_TEXT = 12_000;
const PAGE_TIMEOUT_MS = 8000;

export interface SiteMenuItem {
  name: string;
  description?: string;
  price?: string;
  section?: string;
}

export interface SiteMenu {
  /** The page the menu was read from (or the site, when it came from several). */
  source: string;
  /** Items the site publishes as structured data, when it does. */
  items: SiteMenuItem[];
  /** The menu-looking text of the pages read, when there is no structured data (or beside it when there's little). */
  text: string;
  /** Menus the site offers only as PDF files; not read, but linkable. */
  pdfs: string[];
  pages: number;
}

/** Whether a site is one Wally may read: the restaurant's own, not a marketplace or an ordering platform. */
export function readableSite(url: string | null | undefined): boolean {
  if (!url || !isOwnSite(url)) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(u.protocol)) return false;
  const host = u.hostname.toLowerCase();
  return !PLATFORM_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** The simplest reading of robots.txt: the rules for our agent, else for everyone; the longest matching rule wins. */
export function robotsAllow(robots: string, path: string, agent = "wallybot"): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ allow: key === "allow", path: value });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  const group = groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of group.rules) {
    if (!rule.path) continue;
    const pattern = rule.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const re = new RegExp(`^${pattern}`);
    if (re.test(path) && (!best || rule.path.length > best.length)) best = { allow: rule.allow, length: rule.path.length };
  }
  return best ? best.allow : true;
}

async function fetchText(url: string, accept: string): Promise<{ status: number; type: string; body: string; url: string } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: accept }, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.body) return { status: res.status, type, body: "", url: res.url || url };
    // Read up to the cap, then stop: a menu page is never megabytes of HTML.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
      if (size >= MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    const body = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return { status: res.status, type, body, url: res.url || url };
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", middot: "·", deg: "°", trade: "™", reg: "®", copy: "©",
  eacute: "é", egrave: "è", ecirc: "ê", aacute: "á", agrave: "à", acirc: "â", iacute: "í", oacute: "ó", ocirc: "ô", uacute: "ú", ntilde: "ñ", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", aring: "å", oslash: "ø", szlig: "ß",
};
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** The readable words of a page, one block per line, with scripts, styles and site furniture (nav, header, footer) left out. */
export function pageText(html: string): string {
  let s = html.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style|noscript|svg|template|iframe|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<(nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<(br|hr)\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li|tr|td|th|h[1-6]|section|article|dt|dd|ul|ol|table|blockquote|figcaption|summary|details)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of s.split(/\n+/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 2 || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines.join("\n");
}

/** Lines that look like a menu: a price, or a short dish-like line near one. */
export function menuish(text: string): string {
  const lines = text.split("\n");
  const price = /(^|\s)\$\s?\d{1,3}(\.\d{2})?(\s|$|\/)|\b\d{1,3}\.\d{2}\s*$/;
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, i) => {
    if (price.test(line)) for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 1); j++) keep[j] = true;
  });
  const picked = lines.filter((_, i) => keep[i]);
  // A page with hardly any prices is still worth its words when it is clearly a menu page.
  return picked.length >= 6 ? picked.join("\n") : text;
}

type Json = Record<string, unknown>;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v.trim() || undefined : typeof v === "number" ? String(v) : undefined);

/** Menu items a page publishes as schema.org JSON-LD (Menu, MenuSection, MenuItem, or a Restaurant with hasMenu). */
export function jsonLdMenu(html: string): SiteMenuItem[] {
  const items: SiteMenuItem[] = [];
  const seen = new Set<string>();
  const walk = (node: unknown, section?: string) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, section));
    const o = node as Json;
    const types = asArray(o["@type"]).map((t) => String(t).toLowerCase());
    if (types.includes("menuitem")) {
      const name = str(o.name);
      if (name && !seen.has(`${section}|${name}`)) {
        seen.add(`${section}|${name}`);
        const offer = asArray(o.offers)[0] as Json | undefined;
        const priceValue = offer && (str(offer.price) ?? str((offer.priceSpecification as Json | undefined)?.price));
        const currency = offer && str(offer.priceCurrency);
        items.push({
          name: name.slice(0, 80),
          ...(str(o.description) ? { description: str(o.description)!.slice(0, 200) } : {}),
          ...(priceValue ? { price: /^\d/.test(priceValue) ? `${currency === "USD" || !currency ? "$" : `${currency} `}${priceValue}` : priceValue } : {}),
          ...(section ? { section } : {}),
        });
      }
      return;
    }
    const own = types.includes("menusection") ? str(o.name) : section;
    for (const key of ["hasMenu", "hasMenuSection", "hasMenuItem", "@graph", "mainEntity", "itemListElement"]) if (o[key] !== undefined) walk(o[key], own);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]!.trim()));
    } catch {}
  }
  return items.slice(0, 300);
}

/** Links on a page that lead to its menu, on the same site, and menus offered as PDFs. */
export function menuLinks(html: string, base: string): { pages: string[]; pdfs: string[] } {
  const origin = hostOf(base);
  const pages: string[] = [];
  const pdfs: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeEntities(m[1]!);
    const label = pageText(m[2]!).replace(/\n/g, " ");
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    url.hash = "";
    const key = url.href;
    if (seen.has(key) || hostOf(key) !== origin) continue;
    const hint = `${label} ${url.pathname}`;
    if (/\.pdf(\?|$)/i.test(url.pathname) && /menu|food|drink|brunch|lunch|dinner|breakfast|dessert|wine|cocktail/i.test(hint)) {
      seen.add(key);
      pdfs.push(key);
    } else if (/\bmenus?\b|\bfood\b|\beat\b|\bdishes\b|\bbrunch\b|\blunch\b|\bdinner\b|\bbreakfast\b|\bdessert\b|\bdrinks?\b|\border\b/i.test(hint) && !/\.(jpe?g|png|gif|webp|svg|zip|docx?)(\?|$)/i.test(url.pathname)) {
      seen.add(key);
      pages.push(key);
    }
  }
  return { pages: pages.slice(0, MAX_PAGES - 1), pdfs: pdfs.slice(0, 5) };
}

/** Reads the restaurant's menu from its own site. Null when the site isn't one Wally may read, or nothing menu-like came back. */
export async function readSiteMenu(website: string): Promise<SiteMenu | null> {
  if (!readableSite(website)) return null;
  const start = new URL(website);
  const robots = await fetchText(`${start.origin}/robots.txt`, "text/plain");
  const allowed = (url: string) => (robots && robots.status === 200 && /text\/plain|text\/html|octet/i.test(robots.type || "text/plain") ? robotsAllow(robots.body, new URL(url).pathname) : true);
  if (!allowed(start.href)) return null;

  const home = await fetchText(start.href, "text/html,application/xhtml+xml");
  if (!home || home.status >= 400 || !/html/i.test(home.type)) return null;
  const homeText = pageText(home.body);
  const items = jsonLdMenu(home.body);
  const links = menuLinks(home.body, home.url);
  const more = await Promise.all(links.pages.filter(allowed).map((url) => fetchText(url, "text/html,application/xhtml+xml")));
  const pages = more.filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.status < 400 && /html/i.test(p!.type));
  for (const p of pages) for (const item of jsonLdMenu(p.body)) if (!items.some((i) => i.name === item.name && i.section === item.section)) items.push(item);
  // The page with the most prices on it is the menu; the home page comes last.
  const scored = [...pages.map((p) => ({ url: p.url, text: menuish(pageText(p.body)) })), { url: home.url, text: menuish(homeText) }]
    .map((p) => ({ ...p, prices: (p.text.match(/\$\s?\d/g) ?? []).length }))
    .sort((a, b) => b.prices - a.prices);
  let text = "";
  for (const p of scored) {
    if (text.length >= MAX_TEXT) break;
    text += `${text ? "\n\n" : ""}[${p.url}]\n${p.text}`.slice(0, MAX_TEXT - text.length);
  }
  const pdfs = [...links.pdfs, ...pages.flatMap((p) => menuLinks(p.body, p.url).pdfs)].filter((u, i, all) => all.indexOf(u) === i).slice(0, 5);
  // Nothing menu-like at all: no structured items, no menu page, no PDF, and hardly a price on the home page.
  if (!items.length && !pages.length && !pdfs.length && scored[0]!.prices < 3) return null;
  return { source: scored[0]?.prices ? scored[0].url : home.url, items, text, pdfs, pages: 1 + pages.length };
}
