/**
 * A restaurant's own page on the delivery apps, found the one way rule 8
 * allows: by asking a web search engine, never the app. Brave's Search API
 * (its own index, licensed for this) answers "Kai Sushi Chicago
 * site:doordash.com" with the store pages it has indexed; the page is taken
 * only when its title or address matches the listing, and otherwise the
 * card keeps the app's search for the name. No delivery app is fetched,
 * polled or read. A name differs between listings more often than not
 * ("Kai Sushi" on Google is "Kaido Sushi" on DoorDash), so the match is
 * loose on the name and firm on the place: the city, or the street number
 * when the result shows one.
 */
import { chainOf } from "@/lib/chains";
import { nameMatches } from "./ordering";

export const storeLinksConfigured = () => Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim());

export type DeliveryApp = "doordash" | "ubereats";

const APP_HOST: Record<DeliveryApp, string> = { doordash: "www.doordash.com", ubereats: "www.ubereats.com" };

export interface WebHit {
  title: string;
  url: string;
  snippet: string;
}

/** Where to look. A stand-in server in tests. */
const base = () => process.env.BRAVE_SEARCH_API_BASE?.trim().replace(/\/+$/, "") || "https://api.search.brave.com";

const TIMEOUT_MS = 3500;

/** One web search; empty on any failure (a missing link is never an error). */
export async function webSearch(query: string): Promise<WebHit[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) return [];
  try {
    const q = new URLSearchParams({ q: query, count: "6", country: "us", search_lang: "en", safesearch: "off", text_decorations: "0" });
    const res = await fetch(`${base()}/res/v1/web/search?${q}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[store-links] ${res.status} ${(await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200)}`);
      return [];
    }
    const data = (await res.json()) as { web?: { results?: { title?: string; url?: string; description?: string }[] } };
    return (data.web?.results ?? []).filter((r) => typeof r.url === "string").map((r) => ({ title: r.title ?? "", url: r.url!, snippet: r.description ?? "" }));
  } catch (error) {
    console.error("[store-links] no response", error instanceof Error ? error.name : "");
    return [];
  }
}

export interface PlaceToMatch {
  name: string;
  /** Short street address, as on the card: "1535 W Madison St". */
  address?: string;
  city?: string;
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** The store's own page among the hits, or undefined when none is surely it. */
export function pickStoreLink(app: DeliveryApp, hits: WebHit[], place: PlaceToMatch): string | undefined {
  const city = place.city ? plain(place.city) : "";
  const number = /^\s*(\d+)\b/.exec(place.address ?? "")?.[1];
  const chain = Boolean(chainOf(place.name));
  const candidates: { url: string; score: number; order: number }[] = [];
  hits.forEach((hit, order) => {
    let url: URL;
    try {
      url = new URL(hit.url);
    } catch {
      return;
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== APP_HOST[app].replace(/^www\./, "")) return;
    // A store page: doordash.com/store/<slug>-<id>/, ubereats.com/store/<slug>/<uuid>. Never a search, category or city page.
    const path = url.pathname;
    const store = app === "doordash" ? /^\/store\/[^/]*\d+\/?$/.test(path) : /^\/store\/[^/]+\/[0-9a-f-]{36}\/?$/i.test(path);
    if (!store) return;
    // The listing's name on the app: the title up to the app's own words, else the slug.
    const titled = hit.title.split(/\s[-|–]\s|\bdelivery\b|\bmenu\b|\border online\b/i)[0]?.trim() ?? "";
    const slug = plain(path.split("/")[2] ?? "").replace(/\s\d+$/, "");
    const named = (titled && (nameMatches(place.name, titled) || nameMatches(titled, place.name))) || (slug && (nameMatches(place.name, slug) || nameMatches(slug, place.name)));
    if (!named) return;
    const text = plain(`${hit.title} ${hit.snippet} ${path}`);
    const inCity = Boolean(city) && text.includes(city);
    const atNumber = Boolean(number) && new RegExp(`\\b${number}\\b`).test(`${hit.title} ${hit.snippet}`);
    // A chain has many stores: the city or street number must agree. An independent place with one store is taken on its name.
    if (chain && !inCity && !atNumber) return;
    candidates.push({ url: `${url.origin}${path.replace(/\/?$/, "/")}`, score: (atNumber ? 4 : 0) + (inCity ? 2 : 0), order });
  });
  candidates.sort((a, b) => b.score - a.score || a.order - b.order);
  return candidates[0]?.url;
}

/** The place's own pages on the delivery apps, looked up together; each is missing when not surely found. */
export async function findStoreLinks(place: PlaceToMatch, apps: DeliveryApp[] = ["doordash", "ubereats"]): Promise<Partial<Record<DeliveryApp, string>>> {
  if (!storeLinksConfigured()) return {};
  const found = await Promise.all(
    apps.map(async (app) => {
      const hits = await webSearch(`"${place.name}" ${place.city ?? ""} site:${APP_HOST[app]}`.replace(/\s+/g, " ").trim());
      return [app, pickStoreLink(app, hits, place)] as const;
    }),
  );
  return Object.fromEntries(found.filter(([, url]) => url)) as Partial<Record<DeliveryApp, string>>;
}
