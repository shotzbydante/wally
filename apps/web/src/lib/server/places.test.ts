import { afterEach, describe, expect, it, vi } from "vitest";
import { cityOf, deliveryLinks } from "@/lib/chat";
import { describePlaces, placeChoices, placesIntro, shownPlaces, type FoundPlace } from "./agent";
import { findAddress, findAnchor, milesBetween, searchPlaces, suggestAddresses } from "./places";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Answers the next Places request with `places` and records what was asked. */
function google(places: unknown[], status = 200, routingSummaries?: unknown[]) {
  const calls: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "key");
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    calls.push({ headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify(status === 200 ? { places, ...(routingSummaries ? { routingSummaries } : {}) } : { error: { message: "API not enabled" } }), { status });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  return calls;
}

const home = { lat: 34.0639, lng: -118.3592 };

describe("milesBetween", () => {
  it("measures straight-line miles to one decimal", () => {
    expect(milesBetween(home, home)).toBe(0);
    // Wilshire and Fairfax to Hollywood and Vine is about three miles.
    expect(milesBetween(home, { lat: 34.1016, lng: -118.3269 })).toBe(3.2);
  });
});

describe("findAddress", () => {
  it("returns Google's spelling and the coordinates", async () => {
    const calls = google([{ formattedAddress: "5905 Wilshire Blvd, Los Angeles, CA 90036, USA", location: { latitude: 34.0639, longitude: -118.3592 } }]);
    expect(await findAddress("5905 wilshire")).toEqual({ address: "5905 Wilshire Blvd, Los Angeles, CA 90036, USA", point: home });
    expect(calls[0]).toMatchObject({ headers: { "X-Goog-Api-Key": "key", "X-Goog-FieldMask": "places.formattedAddress,places.location" }, body: { textQuery: "5905 wilshire", pageSize: 1 } });
  });
  it("is null when Google can't place it", async () => {
    google([]);
    expect(await findAddress("nowhere")).toBeNull();
  });
});

describe("searchPlaces", () => {
  const raw = { id: "abc", displayName: { text: " Milk Bar " }, shortFormattedAddress: "7150 Melrose Ave", primaryTypeDisplayName: { text: "Dessert shop" }, editorialSummary: { text: " Playful bakery known for cereal milk soft serve. " }, location: { latitude: 34.08, longitude: -118.34 }, currentOpeningHours: { openNow: true, nextCloseTime: "2026-10-13T04:00:00Z" }, rating: 4.5, userRatingCount: 812, priceLevel: "PRICE_LEVEL_MODERATE", websiteUri: "https://milkbarstore.com/", googleMapsUri: "https://maps.google.com/?cid=1", takeout: true, delivery: false, dineIn: true, timeZone: { id: "America/Los_Angeles" } };
  const none = { takeout: null, delivery: null, dineIn: null, reservable: null, timeZone: null };

  it("leans toward the saved address and tidies what comes back", async () => {
    const calls = google([raw, { ...raw, id: "gone", businessStatus: "CLOSED_PERMANENTLY" }, { id: "bare", displayName: { text: "Bare" }, websiteUri: "javascript:alert(1)" }]);
    expect(await searchPlaces({ query: "dessert near me", near: home, openNow: true })).toEqual([
      { id: "abc", name: "Milk Bar", address: "7150 Melrose Ave", kind: "Dessert shop", summary: "Playful bakery known for cereal milk soft serve.", point: { lat: 34.08, lng: -118.34 }, open: true, closes: "2026-10-13T04:00:00Z", rating: 4.5, ratings: 812, price: "$$", website: "https://milkbarstore.com/", maps: "https://maps.google.com/?cid=1", takeout: true, delivery: false, dineIn: true, reservable: null, timeZone: "America/Los_Angeles" },
      { id: "bare", name: "Bare", address: "", kind: "", summary: null, point: null, open: null, closes: null, rating: null, ratings: null, price: null, website: null, maps: "https://www.google.com/maps/place/?q=place_id:bare", ...none },
    ]);
    // Held to a box about 25 miles each way, so a bigger city far away can't answer.
    expect(calls[0]!.body).toEqual({ textQuery: "dessert", pageSize: 20, openNow: true, locationRestriction: { rectangle: { low: { latitude: 33.7016, longitude: -118.7966 }, high: { latitude: 34.4262, longitude: -117.9218 } } } });
    // The service flags and time zone ride in the same billing tier; no routing was asked for.
    expect(calls[0]!.headers["X-Goog-FieldMask"]).toMatch(/places\.takeout,places\.delivery,places\.dineIn,places\.reservable,places\.timeZone$/);
  });
  it("asks Google how long each place takes to reach, and keeps the answers in step with the places", async () => {
    const calls = google(
      [raw, { ...raw, id: "gone", businessStatus: "CLOSED_PERMANENTLY" }, { ...raw, id: "far" }, { ...raw, id: "unrouted" }],
      200,
      [{ legs: [{ duration: "597s", distanceMeters: 2607 }] }, { legs: [{ duration: "10s", distanceMeters: 10 }] }, { legs: [{ duration: "1501.5s", distanceMeters: 8046 }] }, {}],
    );
    const places = await searchPlaces({ query: "dessert", near: home, travel: { from: home, mode: "WALK" } });
    expect(places.map((p) => [p.id, p.travel])).toEqual([
      ["abc", { mode: "WALK", minutes: 10, miles: 1.6 }],
      ["far", { mode: "WALK", minutes: 25, miles: 5 }],
      ["unrouted", undefined],
    ]);
    expect(calls[0]!.body).toMatchObject({ routingParameters: { origin: { latitude: 34.0639, longitude: -118.3592 }, travelMode: "WALK" } });
    expect(calls[0]!.headers["X-Goog-FieldMask"]).toMatch(/,routingSummaries$/);
  });
  it("searches a named area instead of the saved address", async () => {
    const calls = google([]);
    await searchPlaces({ query: "dessert", near: home, area: "Koreatown" });
    expect(calls[0]!.body).toEqual({ textQuery: "dessert near Koreatown", pageSize: 20 });
  });
  it("holds a search to a few miles around a named spot once it has been placed, further around a city", async () => {
    const calls = google([]);
    const pantages = { name: "Pantages Theatre", point: { lat: 34.1019, lng: -118.3265 }, wide: false };
    await searchPlaces({ query: "burgers near the theater", near: home, area: "Pantages Theatre, Hollywood", anchor: pantages });
    expect(calls[0]!.body).toEqual({ textQuery: "burgers near the theater", pageSize: 20, locationRestriction: { rectangle: { low: { latitude: 34.0439, longitude: -118.3965 }, high: { latitude: 34.1599, longitude: -118.2565 } } } });
    await searchPlaces({ query: "burgers", area: "Fresno", anchor: { ...pantages, name: "Fresno", wide: true } });
    const box = (calls[1]!.body.locationRestriction as { rectangle: { low: { latitude: number }; high: { latitude: number } } }).rectangle;
    expect(Math.round((box.high.latitude - box.low.latitude) * 69)).toBe(20);
  });
  it("throws when Google refuses", async () => {
    google([], 403);
    await expect(searchPlaces({ query: "dessert" })).rejects.toThrow("403");
  });
});

describe("findAnchor", () => {
  it("places a named venue at the cheapest tier and tells a city from a spot", async () => {
    const calls = google([{ displayName: { text: " Pantages Theatre " }, location: { latitude: 34.1019, longitude: -118.3265 }, types: ["performing_arts_theater", "point_of_interest"] }]);
    expect(await findAnchor("Pantages theater in Hollywood")).toEqual({ name: "Pantages Theatre", point: { lat: 34.1019, lng: -118.3265 }, wide: false });
    expect(calls[0]).toMatchObject({ headers: { "X-Goog-FieldMask": "places.displayName,places.location,places.types" }, body: { textQuery: "Pantages theater in Hollywood", pageSize: 1 } });
    google([{ displayName: { text: "Fresno" }, location: { latitude: 36.7378, longitude: -119.7871 }, types: ["locality", "political"] }]);
    expect(await findAnchor("Fresno")).toMatchObject({ name: "Fresno", wide: true });
  });
  it("is null when Google can't place it", async () => {
    google([]);
    expect(await findAnchor("nowhere in particular")).toBeNull();
  });
});

describe("cityOf", () => {
  it("keeps only the city and state of an address", () => {
    expect(cityOf("10764 N Backer Ave, Fresno, CA 93730, USA")).toBe("Fresno, CA");
    expect(cityOf("215 S Mansfield Ave, Los Angeles, CA 90036")).toBe("Los Angeles, CA");
    expect(cityOf("My current location")).toBeUndefined();
    expect(cityOf(null)).toBeUndefined();
  });
});

describe("suggestAddresses", () => {
  it("asks for US street addresses near the saved one and tidies the answers", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "key");
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return new Response(JSON.stringify({ suggestions: [
        { placePrediction: { text: { text: "215 S Mansfield Ave, Los Angeles, CA, USA" }, structuredFormat: { mainText: { text: "215 S Mansfield Ave" }, secondaryText: { text: "Los Angeles, CA, USA" } } } },
        { queryPrediction: { text: { text: "215 south" } } },
      ] }));
    });
    expect(await suggestAddresses("215 S", { near: home, session: "abcd-1234" })).toEqual([{ text: "215 S Mansfield Ave, Los Angeles, CA", main: "215 S Mansfield Ave", secondary: "Los Angeles, CA" }]);
    expect(calls[0]!.url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(calls[0]!.body).toMatchObject({ input: "215 S", includedRegionCodes: ["us"], sessionToken: "abcd-1234", locationBias: { circle: { center: { latitude: 34.0639, longitude: -118.3592 } } } });
  });
  it("throws when Google refuses", async () => {
    google([], 403);
    await expect(suggestAddresses("215 S")).rejects.toThrow("403");
  });
});

describe("place cards", () => {
  const place = (id: string, name: string, open: boolean | null, miles?: number): FoundPlace => ({ id, name, address: "1 Main St", kind: "Bakery", summary: null, point: null, open, closes: null, rating: 4.5, ratings: 10, price: null, website: open ? `https://${id}.example/` : null, maps: `https://maps.example/${id}`, takeout: null, delivery: null, dineIn: null, reservable: null, timeZone: null, miles });
  const found = new Map<string, FoundPlace>([
    ["p1", place("far", "Far Open", true, 3.2)],
    ["p2", place("closed", "Closed Close", false, 0.1)],
    ["p3", place("near", "Near Open", true, 0.4)],
    ["p4", place("unknown", "Unknown Hours", null, 0.9)],
    ["p5", place("extra", "Extra Open", true, 5)],
  ]);
  const pick = (...ids: string[]) => ({ places: ids.map((id) => ({ id, emoji: "🍰", detail: "Fits." })) });

  it("puts open places first, nearest first, and takes every fact from the search", () => {
    const cards = placeChoices(pick("p2", "p1", "p4", "p3"), found)!;
    expect(cards.map((c) => c.title)).toEqual(["Near Open", "Far Open", "Unknown Hours", "Closed Close"]);
    expect(cards[0]).toEqual({ emoji: "🍰", title: "Near Open", detail: "Fits.", reply: "Tell me more about Near Open", place: { id: "near", miles: 0.4, open: true, rating: 4.5, website: "https://near.example/", maps: "https://maps.example/near" } });
    expect(cards[3]!.place).toEqual({ id: "closed", miles: 0.1, open: false, rating: 4.5, maps: "https://maps.example/closed" });
  });
  it("drops ids the search never returned, and repeats", () => {
    expect(placeChoices(pick("p3", "p99", "p3"), found)!.map((c) => c.title)).toEqual(["Near Open"]);
    expect(placeChoices(pick("p99"), found)).toBeNull();
    expect(placeChoices({ places: "p1" }, found)).toBeNull();
  });
  it("keeps the four best once sorted", () => {
    expect(placeChoices(pick("p2", "p5", "p4", "p1", "p3"), found)!.map((c) => c.title)).toEqual(["Near Open", "Far Open", "Extra Open", "Unknown Hours"]);
  });
  it("tells Claude what was found without links or Google ids", () => {
    const told = describePlaces(found, ["p1", "p4"]);
    expect(JSON.parse(told)).toEqual([
      { id: "p1", name: "Far Open", kind: "Bakery", miles: 3.2, open_now: true, rating: 4.5, ratings: 10, own_site: true, address: "1 Main St" },
      { id: "p4", name: "Unknown Hours", kind: "Bakery", miles: 0.9, open_now: "unknown", rating: 4.5, ratings: 10, address: "1 Main St" },
    ]);
    expect(describePlaces(found, [])).toMatch(/No places matched/);
  });
  it("says what distances are measured from when the person named a spot, and which are a walk", () => {
    const near = new Map<string, FoundPlace>([
      ["p1", { ...place("a", "Carney's", true, 0.3), from: "Pantages Theatre" }],
      ["p2", { ...place("b", "Mel's", true, 1.4), from: "Pantages Theatre" }],
    ]);
    expect(JSON.parse(describePlaces(near, ["p1", "p2"]))).toMatchObject([
      { name: "Carney's", miles: 0.3, miles_from: "Pantages Theatre", walkable: true },
      { name: "Mel's", miles: 1.4, miles_from: "Pantages Theatre", walkable: false },
    ]);
    const cards = placeChoices(pick("p2", "p1"), near)!;
    expect(cards[0]!.place).toMatchObject({ miles: 0.3, from: "Pantages Theatre" });
    expect(placesIntro({}, cards)).toBe("I'd start with Carney's: 0.3 miles from Pantages Theatre, open now, rated 4.5. A few more worth a look are below.");
    // Near the saved address nothing is said about where from.
    expect(JSON.parse(describePlaces(found, ["p1"]))[0]).not.toHaveProperty("miles_from");
  });
  it("shows travel time on a card, sorts by it, and tells Claude what each place offers", () => {
    const routed = new Map<string, FoundPlace>([
      ["p1", { ...place("a", "Carney's", true, 0.3), from: "Pantages Theatre", travel: { mode: "WALK", minutes: 6, miles: 0.4 }, takeout: true, delivery: false, dineIn: true }],
      ["p2", { ...place("b", "Mel's", true, 0.2), from: "Pantages Theatre", travel: { mode: "WALK", minutes: 9, miles: 0.5 }, reservable: true, timeZone: "America/Los_Angeles", closes: "2026-10-13T04:00:00Z" }],
      ["p3", { ...place("c", "SMSHD", true, 1.0), from: "Pantages Theatre", travel: { mode: "WALK", minutes: 22, miles: 1.3 } }],
    ]);
    expect(JSON.parse(describePlaces(routed, ["p1", "p2", "p3"]))).toMatchObject([
      { name: "Carney's", travel: "6 min walk", walkable: true, takeout: true, delivery: false, dine_in: true },
      { name: "Mel's", travel: "9 min walk", walkable: true, reservable: true, closes: "9:00 PM" },
      { name: "SMSHD", travel: "22 min walk", walkable: false },
    ]);
    // Closer by foot comes first even when the straight line says otherwise.
    const cards = placeChoices(pick("p3", "p2", "p1"), routed)!;
    expect(cards.map((c) => c.title)).toEqual(["Carney's", "Mel's", "SMSHD"]);
    expect(cards[0]!.place).toMatchObject({ miles: 0.3, from: "Pantages Theatre", travel: { mode: "WALK", minutes: 6 } });
    expect(placesIntro({}, cards)).toBe("I'd start with Carney's: a 6 min walk from Pantages Theatre, open now, rated 4.5. A few more worth a look are below.");
  });
  it("tells Claude when a place closes, in the person's time, and which he has already shown", () => {
    const again = new Map<string, FoundPlace>([["p1", { ...place("near", "Near Open", true, 0.4), closes: "2026-10-13T04:00:00Z", shown: true, summary: "Known for layer cakes." }]]);
    expect(JSON.parse(describePlaces(again, ["p1"], "America/Los_Angeles"))[0]).toMatchObject({ closes: "9:00 PM", already_shown: true, known_for: "Known for layer cakes." });
    // Without a time zone the hour would be a guess.
    expect(JSON.parse(describePlaces(again, ["p1"]))[0].closes).toBeUndefined();
  });
  it("always has a line above the cards: Wally's own, or a plain one from the first card", () => {
    const cards = placeChoices(pick("p3", "p1"), found)!;
    expect(placesIntro({ intro: " If it were my night off, I'd head to Near Open. " }, cards)).toBe("If it were my night off, I'd head to Near Open.");
    expect(placesIntro({}, cards)).toBe("I'd start with Near Open: 0.4 miles away, open now, rated 4.5. A few more worth a look are below.");
  });
  it("collects the places earlier answers showed", () => {
    const card = (id: string) => ({ emoji: "🍰", title: id, detail: "", reply: id, place: { id, maps: "https://maps.example" } });
    const message = (id: number, choices: ReturnType<typeof card>[] | null) => ({ id, role: "assistant" as const, channel: "web" as const, content: "", choices, created_at: "2026-10-12T00:00:00Z" });
    expect([...shownPlaces([message(1, [card("a"), card("b")]), message(2, null), message(3, [card("c")])])]).toEqual(["a", "b", "c"]);
  });
});

describe("deliveryLinks", () => {
  it("opens a search for the restaurant in each app", () => {
    expect(deliveryLinks("Joe's Pizza & Pasta")).toEqual([
      { app: "DoorDash", url: "https://www.doordash.com/search/store/Joe's%20Pizza%20%26%20Pasta/" },
      { app: "Uber Eats", url: "https://www.ubereats.com/search?q=Joe's%20Pizza%20%26%20Pasta" },
    ]);
  });
  it("uses the listing's own page on an app when its website is that page", () => {
    expect(deliveryLinks("Bamboo Chinese", "https://www.doordash.com/store/bamboo-chinese-los-angeles-12345/")[0]!.url).toBe("https://www.doordash.com/store/bamboo-chinese-los-angeles-12345/");
    expect(deliveryLinks("Bamboo Chinese", "https://www.doordash.com/store/bamboo-chinese-los-angeles-12345/")[1]!.url).toContain("ubereats.com/search");
    expect(deliveryLinks("Bamboo Chinese", "https://www.doordash.com/")[0]!.url).toContain("/search/store/");
    expect(deliveryLinks("Bamboo Chinese", "https://bamboochinese.com")[0]!.url).toContain("/search/store/");
  });
});
