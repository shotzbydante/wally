/**
 * Real places, from Google's Places API (New). Used for two things: turning
 * a typed address into coordinates, and finding food near them.
 *
 * Google's terms limit what may be kept: place IDs may be stored, other
 * Places content may not be cached. See "Places" in CLAUDE.md before
 * storing anything more from here.
 */
export const placesConfigured = () => Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());

// GOOGLE_PLACES_API_BASE points tests at a stand-in server.
const base = () => process.env.GOOGLE_PLACES_API_BASE?.trim().replace(/\/+$/, "") || "https://places.googleapis.com";
const endpoint = () => `${base()}/v1/places:searchText`;

export class PlacesError extends Error {}

export interface Point {
  lat: number;
  lng: number;
}

/** A place as Wally's tools and the cards use it. */
export interface Place {
  /** Google's place ID. */
  id: string;
  name: string;
  /** Short street address. */
  address: string;
  /** What kind of place, in Google's words: "Ice cream shop". */
  kind: string;
  /** Google's one-line description of the place and what it is known for, when it has one. */
  summary: string | null;
  point: Point | null;
  /** Open at the moment of the search. Null when Google doesn't know. */
  open: boolean | null;
  /** When it next closes (ISO time), if it is open and Google says. */
  closes: string | null;
  rating: number | null;
  ratings: number | null;
  /** "$" to "$$$$", or null. */
  price: string | null;
  website: string | null;
  maps: string;
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  primaryTypeDisplayName?: { text?: string };
  editorialSummary?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  currentOpeningHours?: { openNow?: boolean; nextCloseTime?: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
}

const PRICE: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

async function searchText(body: Record<string, unknown>, fields: string[]): Promise<RawPlace[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new PlacesError("places not configured");
  let res: Response;
  try {
    res = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields.map((f) => `places.${f}`).join(",") },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (cause) {
    console.error("[places] no response", cause instanceof Error ? cause.name : "");
    throw new PlacesError("no response");
  }
  if (!res.ok) {
    // Google's error body names the cause (key restricted, API not enabled) and holds no secrets.
    console.error(`[places] ${res.status} ${(await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300)}`);
    throw new PlacesError(String(res.status));
  }
  return ((await res.json()) as { places?: RawPlace[] }).places ?? [];
}

const pointOf = (raw: RawPlace): Point | null =>
  typeof raw.location?.latitude === "number" && typeof raw.location.longitude === "number"
    ? { lat: raw.location.latitude, lng: raw.location.longitude }
    : null;

const httpsUrl = (value: string | undefined): string | null => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

/** Turns a typed address into Google's spelling of it and its coordinates. Null if Google can't place it. */
/** The 5-digit ZIP a point sits in, by Google's Geocoding API; nothing stored. */
export async function zipAt(point: Point): Promise<string | undefined> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return undefined;
  const q = new URLSearchParams({ latlng: `${point.lat},${point.lng}`, result_type: "postal_code", key });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${q}`);
  if (!res.ok) return undefined;
  const data = (await res.json()) as { results?: { address_components?: { types?: string[]; short_name?: string }[] }[] };
  for (const r of data.results ?? []) for (const c of r.address_components ?? []) if (c.types?.includes("postal_code") && /^\d{5}$/.test(c.short_name ?? "")) return c.short_name;
  return undefined;
}

export async function findAddress(typed: string): Promise<{ address: string; point: Point } | null> {
  const [first] = await searchText({ textQuery: typed, pageSize: 1 }, ["formattedAddress", "location"]);
  const point = first && pointOf(first);
  return first?.formattedAddress && point ? { address: first.formattedAddress, point } : null;
}

/** An address Google offers for what has been typed so far. */
export interface AddressSuggestion {
  /** The whole address, as it should be looked up and saved. */
  text: string;
  /** The street part, and the rest, for showing on two levels. */
  main: string;
  secondary: string;
}

interface RawSuggestion {
  placePrediction?: { text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } };
}

/**
 * Street addresses in the US that match the typed start of one, nearest the
 * saved address first when there is one. Shown as typed-ahead suggestions;
 * nothing from here is stored.
 */
export async function suggestAddresses(typed: string, options: { near?: Point | null; session?: string } = {}): Promise<AddressSuggestion[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new PlacesError("places not configured");
  let res: Response;
  try {
    res = await fetch(`${base()}/v1/places:autocomplete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input: typed,
        includedRegionCodes: ["us"],
        includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
        ...(options.session ? { sessionToken: options.session } : {}),
        ...(options.near ? { locationBias: { circle: { center: { latitude: options.near.lat, longitude: options.near.lng }, radius: 50000 } } } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
  } catch (cause) {
    console.error("[places] no response", cause instanceof Error ? cause.name : "");
    throw new PlacesError("no response");
  }
  if (!res.ok) {
    console.error(`[places] ${res.status} ${(await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300)}`);
    throw new PlacesError(String(res.status));
  }
  const tidy = (text: string | undefined) => (text ?? "").replace(/,\s*(USA|United States)$/i, "").trim();
  return (((await res.json()) as { suggestions?: RawSuggestion[] }).suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p) => p?.text?.text)
    .slice(0, 5)
    .map((p) => ({ text: tidy(p!.text!.text), main: tidy(p!.structuredFormat?.mainText?.text) || tidy(p!.text!.text), secondary: tidy(p!.structuredFormat?.secondaryText?.text) }));
}

/** How far from the saved address a search may reach, in miles each way. */
const NEARBY_MILES = 25;

/**
 * The box around a point that a nearby search is held to. A lean toward the
 * point isn't enough: Google will still answer with a bigger city's places.
 */
function boxAround(point: Point) {
  const lat = NEARBY_MILES / 69;
  const lng = lat / Math.max(Math.cos((point.lat * Math.PI) / 180), 0.2);
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  return {
    rectangle: {
      low: { latitude: round(Math.max(point.lat - lat, -90)), longitude: round(Math.max(point.lng - lng, -180)) },
      high: { latitude: round(Math.min(point.lat + lat, 90)), longitude: round(Math.min(point.lng + lng, 180)) },
    },
  };
}

/** "pizza near me" is just "pizza": where "me" is comes from the saved address, not the words. */
const withoutNearMe = (query: string) => query.replace(/\s*\b(near|around|close to|by)\s+(me|here|my (location|address|house|home|place))\b/gi, "").trim() || query;

/** Places asked for in one search. Google allows up to 20, which is five screens of four. */
const PAGE_SIZE = 20;

export interface PlaceSearch {
  /** What to look for: "dessert", "ramen", "late night tacos". */
  query: string;
  /** Search only around here. */
  near?: Point | null;
  /** A neighbourhood, city or ZIP the person named, searched instead of `near`. */
  area?: string;
  openNow?: boolean;
}

/** Food and drink places matching the search, in Google's order. */
export async function searchPlaces(search: PlaceSearch): Promise<Place[]> {
  const area = search.area?.trim();
  const raw = await searchText(
    {
      textQuery: area ? `${withoutNearMe(search.query)} near ${area}` : withoutNearMe(search.query),
      pageSize: PAGE_SIZE,
      ...(search.openNow ? { openNow: true } : {}),
      ...(!area && search.near ? { locationRestriction: boxAround(search.near) } : {}),
    },
    ["id", "displayName", "shortFormattedAddress", "formattedAddress", "primaryTypeDisplayName", "editorialSummary", "location", "currentOpeningHours", "rating", "userRatingCount", "priceLevel", "websiteUri", "googleMapsUri", "businessStatus"],
  );
  return raw
    .filter((p) => p.id && p.displayName?.text && (!p.businessStatus || p.businessStatus === "OPERATIONAL"))
    .map((p) => ({
      id: p.id!,
      name: p.displayName!.text!.trim(),
      address: p.shortFormattedAddress ?? p.formattedAddress ?? "",
      kind: p.primaryTypeDisplayName?.text ?? "",
      summary: p.editorialSummary?.text?.trim().slice(0, 240) || null,
      point: pointOf(p),
      open: typeof p.currentOpeningHours?.openNow === "boolean" ? p.currentOpeningHours.openNow : null,
      closes: p.currentOpeningHours?.openNow === true && !Number.isNaN(Date.parse(p.currentOpeningHours.nextCloseTime ?? "")) ? p.currentOpeningHours.nextCloseTime! : null,
      rating: typeof p.rating === "number" ? p.rating : null,
      ratings: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
      price: PRICE[p.priceLevel ?? ""] ?? null,
      website: httpsUrl(p.websiteUri),
      // The place's page on Google Maps. If Google sent none, the place ID still finds it.
      maps: httpsUrl(p.googleMapsUri) ?? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.id!)}`,
    }));
}

/** Straight-line miles between two points, to one decimal place. */
export function milesBetween(a: Point, b: Point): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}
