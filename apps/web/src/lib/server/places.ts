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
const endpoint = () => `${process.env.GOOGLE_PLACES_API_BASE?.trim().replace(/\/+$/, "") || "https://places.googleapis.com"}/v1/places:searchText`;

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
  point: Point | null;
  /** Open at the moment of the search. Null when Google doesn't know. */
  open: boolean | null;
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
  location?: { latitude?: number; longitude?: number };
  currentOpeningHours?: { openNow?: boolean };
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
export async function findAddress(typed: string): Promise<{ address: string; point: Point } | null> {
  const [first] = await searchText({ textQuery: typed, pageSize: 1 }, ["formattedAddress", "location"]);
  const point = first && pointOf(first);
  return first?.formattedAddress && point ? { address: first.formattedAddress, point } : null;
}

/** How far around the saved address to lean the search, in metres. */
const NEARBY_RADIUS = 8000;

export interface PlaceSearch {
  /** What to look for: "dessert", "ramen", "late night tacos". */
  query: string;
  /** Lean results toward here. */
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
      textQuery: area ? `${search.query} near ${area}` : search.query,
      pageSize: 12,
      ...(search.openNow ? { openNow: true } : {}),
      ...(!area && search.near ? { locationBias: { circle: { center: { latitude: search.near.lat, longitude: search.near.lng }, radius: NEARBY_RADIUS } } } : {}),
    },
    ["id", "displayName", "shortFormattedAddress", "formattedAddress", "primaryTypeDisplayName", "location", "currentOpeningHours", "rating", "userRatingCount", "priceLevel", "websiteUri", "googleMapsUri", "businessStatus"],
  );
  return raw
    .filter((p) => p.id && p.displayName?.text && (!p.businessStatus || p.businessStatus === "OPERATIONAL"))
    .map((p) => ({
      id: p.id!,
      name: p.displayName!.text!.trim(),
      address: p.shortFormattedAddress ?? p.formattedAddress ?? "",
      kind: p.primaryTypeDisplayName?.text ?? "",
      point: pointOf(p),
      open: typeof p.currentOpeningHours?.openNow === "boolean" ? p.currentOpeningHours.openNow : null,
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
