import { afterEach, describe, expect, it, vi } from "vitest";
import { findStoreLinks, pickStoreLink, type WebHit } from "./store-links";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const hit = (title: string, url: string, snippet = ""): WebHit => ({ title, url, snippet });

describe("picking a store page", () => {
  it("takes the store page whose name matches, even when the app spells the name differently", () => {
    const hits = [
      hit("Best Sushi Delivery in Chicago | DoorDash", "https://www.doordash.com/food-delivery/chicago-il-restaurants/sushi/"),
      hit("Kaido Sushi - Chicago | Delivery Menu & Prices | DoorDash", "https://www.doordash.com/store/kaido-sushi-chicago-24623377/?utm_source=x", "Get delivery from Kaido Sushi, 2135 N Western Ave, Chicago."),
    ];
    expect(pickStoreLink("doordash", hits, { name: "Kai Sushi", address: "2135 N Western Ave", city: "Chicago" })).toBe("https://www.doordash.com/store/kaido-sushi-chicago-24623377/");
  });
  it("never takes a search, category or other app's page, nor a store with another name", () => {
    const hits = [
      hit("Sushi near me | DoorDash", "https://www.doordash.com/search/store/sushi/"),
      hit("Kai Sushi | Uber Eats", "https://www.ubereats.com/store/kai-sushi/8b1b7e0e-1111-4c2b-9f2b-3d4a5b6c7d8e"),
      hit("Sushi Taku - Chicago | DoorDash", "https://www.doordash.com/store/sushi-taku-chicago-1122/"),
    ];
    expect(pickStoreLink("doordash", hits, { name: "Kai Sushi", city: "Chicago" })).toBeUndefined();
    expect(pickStoreLink("ubereats", hits, { name: "Kai Sushi", city: "Chicago" })).toBe("https://www.ubereats.com/store/kai-sushi/8b1b7e0e-1111-4c2b-9f2b-3d4a5b6c7d8e/");
  });
  it("prefers the page that shows the street number, then the city", () => {
    const hits = [
      hit("Taco Bell - Los Angeles | DoorDash", "https://www.doordash.com/store/taco-bell-los-angeles-100/", "Taco Bell, 100 Sunset Blvd, Los Angeles"),
      hit("Taco Bell - Los Angeles | DoorDash", "https://www.doordash.com/store/taco-bell-los-angeles-200/", "Taco Bell, 5905 Wilshire Blvd, Los Angeles"),
    ];
    expect(pickStoreLink("doordash", hits, { name: "Taco Bell", address: "5905 Wilshire Blvd", city: "Los Angeles" })).toBe("https://www.doordash.com/store/taco-bell-los-angeles-200/");
  });
  it("won't guess among a chain's stores without the city or street number agreeing", () => {
    const hits = [hit("Taco Bell - Fresno | DoorDash", "https://www.doordash.com/store/taco-bell-fresno-300/", "Taco Bell, 1 Shaw Ave, Fresno")];
    expect(pickStoreLink("doordash", hits, { name: "Taco Bell", address: "5905 Wilshire Blvd", city: "Los Angeles" })).toBeUndefined();
    expect(pickStoreLink("doordash", hits, { name: "Taco Bell", city: "Fresno" })).toBe("https://www.doordash.com/store/taco-bell-fresno-300/");
  });
});

describe("looking the pages up", () => {
  it("asks the search engine for each app, as the store's name and city on that site, and keeps only sure matches", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "key");
    const queries: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const q = new URL(url).searchParams.get("q")!;
      queries.push(q);
      expect((init.headers as Record<string, string>)["X-Subscription-Token"]).toBe("key");
      const results = q.includes("doordash") ? [{ title: "Kaido Sushi - Chicago | DoorDash", url: "https://www.doordash.com/store/kaido-sushi-chicago-24623377/", description: "" }] : [{ title: "Sushi Taku | Uber Eats", url: "https://www.ubereats.com/store/sushi-taku/8b1b7e0e-1111-4c2b-9f2b-3d4a5b6c7d8e", description: "" }];
      return new Response(JSON.stringify({ web: { results } }), { status: 200 });
    });
    expect(await findStoreLinks({ name: "Kai Sushi", city: "Chicago" })).toEqual({ doordash: "https://www.doordash.com/store/kaido-sushi-chicago-24623377/" });
    expect(queries).toEqual(['"Kai Sushi" Chicago site:www.doordash.com', '"Kai Sushi" Chicago site:www.ubereats.com']);
  });
  it("is empty, never an error, without a key or when the search fails", async () => {
    expect(await findStoreLinks({ name: "Kai Sushi" })).toEqual({});
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => new Response("rate limited", { status: 429 }));
    expect(await findStoreLinks({ name: "Kai Sushi" })).toEqual({});
  });
});
