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
  /** The 5-digit ZIP in its full address, when Google gave one. Used to tell where "near me" is; never shown or stored. */
  zip?: string;
  /** The city in its full address ("Chicago"), when Google gave one. Used to match the place elsewhere; never stored. */
  city?: string;
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
  /** Whether the place offers takeout, delivery, dining in, or takes reservations. Null when Google doesn't say. */
  takeout: boolean | null;
  delivery: boolean | null;
  dineIn: boolean | null;
  reservable: boolean | null;
  /** The place's IANA time zone, so closing times can be phrased for someone whose own zone isn't known (a texter). */
  timeZone: string | null;
  /** How long it takes to get there from the search's origin by road or on foot, when the search asked. */
  travel?: Travel;
}

export type TravelMode = "WALK" | "DRIVE";

export interface Travel {
  mode: TravelMode;
  /** Whole minutes, at least 1. */
  minutes: number;
  /** Road or path miles, to one decimal place. */
  miles: number;
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
  types?: string[];
  takeout?: boolean;
  delivery?: boolean;
  dineIn?: boolean;
  reservable?: boolean;
  timeZone?: { id?: string };
}

/** One per place, in the same order, when the search asked for travel times. Empty for a place Google can't route to. */
interface RawRoutingSummary {
  legs?: { duration?: string; distanceMeters?: number }[];
}

const PRICE: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

/**
 * One Text Search. `fields` are place fields; `top` are fields beside the
 * places list, such as routingSummaries. The field mask is what Google bills
 * by: see "Places" in CLAUDE.md before adding one.
 */
async function searchText(body: Record<string, unknown>, fields: string[], top: string[] = []): Promise<{ places: RawPlace[]; routingSummaries: RawRoutingSummary[] }> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new PlacesError("places not configured");
  let res: Response;
  try {
    res = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": [...fields.map((f) => `places.${f}`), ...top].join(",") },
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
  const data = (await res.json()) as { places?: RawPlace[]; routingSummaries?: RawRoutingSummary[] };
  return { places: data.places ?? [], routingSummaries: data.routingSummaries ?? [] };
}

/** The travel time Google gave for a place, as whole minutes and road miles. Undefined when it gave none. */
function travelOf(summary: RawRoutingSummary | undefined, mode: TravelMode): Travel | undefined {
  const leg = summary?.legs?.[0];
  const seconds = Number.parseFloat(leg?.duration ?? "");
  if (!leg || !Number.isFinite(seconds) || typeof leg.distanceMeters !== "number") return undefined;
  return { mode, minutes: Math.max(1, Math.round(seconds / 60)), miles: Math.round((leg.distanceMeters / 1609.344) * 10) / 10 };
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

/** The city in a full address ("1535 W Madison St, Chicago, IL 60607, USA" → Chicago), when it has one. */
export function cityIn(address: string | null | undefined): string | undefined {
  const parts = (address ?? "").replace(/,\s*(USA|United States)$/i, "").split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 3 ? parts[parts.length - 2]!.slice(0, 40) : undefined;
}

/** The 5-digit ZIP in an address, when it has one ("1535 W Madison St, Chicago, IL 60607" → 60607). */
export function zipIn(address: string | null | undefined): string | undefined {
  return /\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/.exec(address ?? "")?.[1];
}

/**
 * The 5-digit ZIP a point sits in; nothing stored. First by Google's Geocoding
 * API, and when that can't say (the key may not be allowed that API, which it
 * reports as a status, not an error), by the addresses of the places nearest
 * the point in a Places search at the cheapest tier that carries an address.
 * Undefined if neither can say or answers in time.
 */
export async function zipAt(point: Point): Promise<string | undefined> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return undefined;
  const q = new URLSearchParams({ latlng: `${point.lat},${point.lng}`, result_type: "postal_code", key });
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${q}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    const data = res.ok ? ((await res.json()) as { status?: string; error_message?: string; results?: { address_components?: { types?: string[]; short_name?: string }[] }[] }) : { status: String(res.status) };
    for (const r of data.results ?? []) for (const c of r.address_components ?? []) if (c.types?.includes("postal_code") && /^\d{5}$/.test(c.short_name ?? "")) return c.short_name;
    if (data.status !== "OK") console.error(`[places] geocode: ${data.status} ${(data.error_message ?? "").slice(0, 200)}`);
  } catch (error) {
    console.error("[places] geocode: no response", error instanceof Error ? error.name : "");
  }
  return zipNear(point).catch(() => undefined);
}

/** The ZIP most of the nearest places share, by one Places search held to a mile around the point. */
async function zipNear(point: Point): Promise<string | undefined> {
  const { places } = await searchText({ textQuery: "restaurant", pageSize: 5, locationRestriction: boxAround(point, 1) }, ["formattedAddress"]);
  const counts = new Map<string, number>();
  for (const p of places) {
    const zip = zipIn(p.formattedAddress);
    if (zip) counts.set(zip, (counts.get(zip) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Turns a typed address into Google's spelling of it and its coordinates. Null if Google can't place it. */
export async function findAddress(typed: string): Promise<{ address: string; point: Point } | null> {
  const [first] = (await searchText({ textQuery: typed, pageSize: 1 }, ["formattedAddress", "location"])).places;
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
/** How far around a named landmark, venue or neighborhood a search may reach. */
const AROUND_SPOT_MILES = 4;
/** How far around a named city or town. */
const AROUND_CITY_MILES = 10;

/** Google's types for a whole city, town or larger: a search "near" one of these reaches further than around a venue. */
const CITY_TYPES = new Set(["locality", "sublocality", "postal_town", "administrative_area_level_1", "administrative_area_level_2", "administrative_area_level_3", "postal_code", "country"]);

/** A named place to search around, and how far around it a search should reach. */
export interface Anchor {
  /** What Google calls it: "Pantages Theatre", "Fresno". */
  name: string;
  point: Point;
  /** True for a city, town, ZIP or region, which stands for a wider area than a venue or neighborhood does. */
  wide: boolean;
}

/**
 * Where a named area, landmark or venue is ("Pantages theater in Hollywood",
 * "Silver Lake", "Fresno"), by one Places lookup at the cheapest tier.
 * Null if Google can't place it. Nothing is stored.
 */
export async function findAnchor(named: string): Promise<Anchor | null> {
  const [first] = (await searchText({ textQuery: named, pageSize: 1 }, ["displayName", "location", "types"])).places;
  const point = first && pointOf(first);
  if (!first?.displayName?.text || !point) return null;
  return { name: first.displayName.text.trim(), point, wide: (first.types ?? []).some((t) => CITY_TYPES.has(t)) };
}

/**
 * The box around a point that a nearby search is held to. A lean toward the
 * point isn't enough: Google will still answer with a bigger city's places.
 */
function boxAround(point: Point, miles = NEARBY_MILES) {
  const lat = miles / 69;
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
  /** Lean toward here without being held to it: for a place named by name, which may be in another city altogether. Ignored when `near`, `area` or `anchor` is given. */
  bias?: Point | null;
  /** A neighbourhood, city or ZIP the person named, searched instead of `near`. Used as words when there is no `anchor` for it. */
  area?: string;
  /** Where `area` is, when it has been looked up: the search is then held to a box around it instead of leaning on the words. */
  anchor?: Anchor | null;
  openNow?: boolean;
  /** The quick-service kind of answer: fast food, drive-thrus, the big chains. The query is steered that way; Google has no drive-thru field to filter on. */
  fastFood?: boolean;
  /** Fewer results than a full page, for a lookup of one named place. */
  limit?: number;
  /** Ask Google how long each place takes to reach from here, on foot or by road. Costs nothing extra within the search's billing tier. */
  travel?: { from: Point; mode: TravelMode } | null;
}

/** The place fields a search asks for. Together they put a search in the Enterprise + Atmosphere tier; the service and travel fields ride in that tier for free. */
const SEARCH_FIELDS = ["id", "displayName", "shortFormattedAddress", "formattedAddress", "primaryTypeDisplayName", "editorialSummary", "location", "currentOpeningHours", "rating", "userRatingCount", "priceLevel", "websiteUri", "googleMapsUri", "businessStatus", "takeout", "delivery", "dineIn", "reservable", "timeZone"];

const flag = (value: boolean | undefined): boolean | null => (typeof value === "boolean" ? value : null);

/** Food and drink places matching the search, in Google's order. */
export async function searchPlaces(search: PlaceSearch): Promise<Place[]> {
  const area = search.area?.trim();
  const anchor = search.anchor ?? null;
  const travel = search.travel ?? null;
  const query = search.fastFood && !/fast[\s-]?food|drive[\s-]?thr/i.test(search.query) ? `${withoutNearMe(search.query)} fast food drive-thru`.trim() : withoutNearMe(search.query);
  const { places: raw, routingSummaries } = await searchText(
    {
      textQuery: area && !anchor ? `${query} near ${area}` : query,
      pageSize: search.limit ?? PAGE_SIZE,
      ...(search.openNow ? { openNow: true } : {}),
      ...(anchor
        ? { locationRestriction: boxAround(anchor.point, anchor.wide ? AROUND_CITY_MILES : AROUND_SPOT_MILES) }
        : !area && search.near
          ? { locationRestriction: boxAround(search.near) }
          : !area && search.bias
            ? { locationBias: { circle: { center: { latitude: search.bias.lat, longitude: search.bias.lng }, radius: 50000 } } }
            : {}),
      ...(travel ? { routingParameters: { origin: { latitude: travel.from.lat, longitude: travel.from.lng }, travelMode: travel.mode } } : {}),
    },
    SEARCH_FIELDS,
    travel ? ["routingSummaries"] : [],
  );
  return raw
    .map((p, i) => ({ p, travel: travel ? travelOf(routingSummaries[i], travel.mode) : undefined }))
    .filter(({ p }) => p.id && p.displayName?.text && (!p.businessStatus || p.businessStatus === "OPERATIONAL"))
    .map(({ p, travel }) => ({
      id: p.id!,
      name: p.displayName!.text!.trim(),
      address: p.shortFormattedAddress ?? p.formattedAddress ?? "",
      ...(zipIn(p.formattedAddress) ? { zip: zipIn(p.formattedAddress) } : {}),
      ...(cityIn(p.formattedAddress) ? { city: cityIn(p.formattedAddress) } : {}),
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
      takeout: flag(p.takeout),
      delivery: flag(p.delivery),
      dineIn: flag(p.dineIn),
      reservable: flag(p.reservable),
      timeZone: p.timeZone?.id?.trim() || null,
      ...(travel ? { travel } : {}),
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
