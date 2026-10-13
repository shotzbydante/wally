import { afterEach, describe, expect, it, vi } from "vitest";
import { deliveryLinks } from "@/lib/chat";
import { describePlaces, placeChoices, shownPlaces, type FoundPlace } from "./agent";
import { findAddress, milesBetween, searchPlaces } from "./places";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Answers the next Places request with `places` and records what was asked. */
function google(places: unknown[], status = 200) {
  const calls: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "key");
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    calls.push({ headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify(status === 200 ? { places } : { error: { message: "API not enabled" } }), { status });
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
  const raw = { id: "abc", displayName: { text: " Milk Bar " }, shortFormattedAddress: "7150 Melrose Ave", primaryTypeDisplayName: { text: "Dessert shop" }, location: { latitude: 34.08, longitude: -118.34 }, currentOpeningHours: { openNow: true, nextCloseTime: "2026-10-13T04:00:00Z" }, rating: 4.5, userRatingCount: 812, priceLevel: "PRICE_LEVEL_MODERATE", websiteUri: "https://milkbarstore.com/", googleMapsUri: "https://maps.google.com/?cid=1" };

  it("leans toward the saved address and tidies what comes back", async () => {
    const calls = google([raw, { ...raw, id: "gone", businessStatus: "CLOSED_PERMANENTLY" }, { id: "bare", displayName: { text: "Bare" }, websiteUri: "javascript:alert(1)" }]);
    expect(await searchPlaces({ query: "dessert", near: home, openNow: true })).toEqual([
      { id: "abc", name: "Milk Bar", address: "7150 Melrose Ave", kind: "Dessert shop", point: { lat: 34.08, lng: -118.34 }, open: true, closes: "2026-10-13T04:00:00Z", rating: 4.5, ratings: 812, price: "$$", website: "https://milkbarstore.com/", maps: "https://maps.google.com/?cid=1" },
      { id: "bare", name: "Bare", address: "", kind: "", point: null, open: null, closes: null, rating: null, ratings: null, price: null, website: null, maps: "https://www.google.com/maps/place/?q=place_id:bare" },
    ]);
    expect(calls[0]!.body).toEqual({ textQuery: "dessert", pageSize: 20, openNow: true, locationBias: { circle: { center: { latitude: 34.0639, longitude: -118.3592 }, radius: 8000 } } });
  });
  it("searches a named area instead of the saved address", async () => {
    const calls = google([]);
    await searchPlaces({ query: "dessert", near: home, area: "Koreatown" });
    expect(calls[0]!.body).toEqual({ textQuery: "dessert near Koreatown", pageSize: 20 });
  });
  it("throws when Google refuses", async () => {
    google([], 403);
    await expect(searchPlaces({ query: "dessert" })).rejects.toThrow("403");
  });
});

describe("place cards", () => {
  const place = (id: string, name: string, open: boolean | null, miles?: number): FoundPlace => ({ id, name, address: "1 Main St", kind: "Bakery", point: null, open, closes: null, rating: 4.5, ratings: 10, price: null, website: open ? `https://${id}.example/` : null, maps: `https://maps.example/${id}`, miles });
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
  it("tells Claude when a place closes, in the person's time, and which he has already shown", () => {
    const again = new Map<string, FoundPlace>([["p1", { ...place("near", "Near Open", true, 0.4), closes: "2026-10-13T04:00:00Z", shown: true }]]);
    expect(JSON.parse(describePlaces(again, ["p1"], "America/Los_Angeles"))[0]).toMatchObject({ closes: "9:00 PM", already_shown: true });
    // Without a time zone the hour would be a guess.
    expect(JSON.parse(describePlaces(again, ["p1"]))[0].closes).toBeUndefined();
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
});
