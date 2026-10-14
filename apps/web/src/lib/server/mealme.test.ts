import { afterEach, describe, expect, it, vi } from "vitest";
import { dollars, ticketLines, asPlainText, asTexts } from "@/lib/chat";
import { describeMenu, storeMatches, type MenuFound } from "./agent";
import { checkout, sameStore, searchMenu, searchStores, zipOf, type MenuItem, type Store } from "./mealme";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Answers MealMe requests in order and records them. */
function mealme(answers: { status?: number; body: unknown }[]) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubEnv("MEALME_API_KEY", "mm_live_test");
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body as string) : undefined });
    const a = answers.shift() ?? { status: 500, body: { message: "unexpected call" } };
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200 });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  return calls;
}

const store: Store = { id: "cashapp_abc", name: "Poke Bar Los Angeles", address: "5273 W Olympic Blvd", miles: 0.7, open: true };
const bowl: MenuItem = {
  id: "CALI_1", name: "Small Poke Bowl", description: "Build your bowl.", cents: 1549, unitToken: "LCS", variationId: "CALIV_1", variationName: "Regular", pickup: true,
  required: [
    { id: "L1", name: "Base Choice", min: 1, max: 2, options: [{ id: "M1", name: "White Rice", cents: 0 }, { id: "M2", name: "Brown Rice", cents: 0 }] },
    { id: "L2", name: "Protein", min: 1, max: 1, options: [{ id: "M3", name: "Salmon", cents: 0 }, { id: "M4", name: "Tuna", cents: 150 }] },
  ],
};

describe("mealme", () => {
  it("reads the ZIP out of a saved address", () => {
    expect(zipOf("215 S Mansfield Ave, Los Angeles, CA 90036, USA")).toBe("90036");
    expect(zipOf("10764 N Backer Ave, Fresno, CA 93730-1234")).toBe("93730");
    expect(zipOf("My current location")).toBeUndefined();
  });
  it("searches stores near a ZIP and tidies them", async () => {
    const calls = mealme([{ body: { stores: [{ providerLocationId: "cashapp_abc", name: " Poke Bar Los Angeles ", address: "5273 W Olympic Blvd", raw: { distanceMiles: 0.731, isOpen: true } }] } }]);
    expect(await searchStores("90036")).toEqual([store]);
    expect(calls[0]!.url).toContain("/api/stores/search?providerId=square&merchantType=restaurant&zipCode=90036");
  });
  it("steps a wide store search down when MealMe fails on it", async () => {
    const raw = { providerLocationId: "cashapp_abc", name: "Poke Bar Los Angeles", address: "5273 W Olympic Blvd", raw: { distanceMiles: 0.7, isOpen: true } };
    const calls = mealme([{ status: 500, body: { message: "boom" } }, { status: 500, body: { message: "boom" } }, { body: { stores: [raw] } }]);
    expect(await searchStores("90036", 80, 8)).toEqual([store]);
    expect(calls.map((c) => /radiusInMiles=(\d+)&limit=(\d+)/.exec(c.url)!.slice(1).join("/"))).toEqual(["8/80", "6/40", "6/20"]);
    await expect(searchStores("90036", 20)).rejects.toThrow();
  });
  it("reads a menu item with its required choices", async () => {
    mealme([{ body: { items: [{ providerItemId: "CALI_1", title: "Small Poke Bowl", description: "Build your bowl.", price: { amount: 1549 }, fulfillment: ["PICKUP"], raw: { unitToken: "LCS", menuItemVariationId: "CALIV_1", variations: [{ id: "CALIV_1", name: "Regular" }], requiredModifierLists: [{ id: "L1", name: "Base Choice", minSelection: 1, maxSelection: 2, options: [{ id: "M1", name: "White Rice", price: { amount: 0 } }, { id: "M2", name: "Brown Rice", price: { amount: 0 } }] }, { id: "L2", name: "Protein", minSelection: 1, maxSelection: 1, options: [{ id: "M3", name: "Salmon", price: { amount: 0 } }, { id: "M4", name: "Tuna", price: { amount: 150 } }] }] } }, { providerItemId: "x", title: "No tokens" }] } }]);
    expect(await searchMenu("cashapp_abc", "bowl")).toEqual([bowl]);
  });
  it("builds the cart and returns the restaurant's own figures", async () => {
    const calls = mealme([
      { status: 201, body: { cartId: "square_c1" } },
      { body: { status: "updated" } },
      { body: { checkoutUrl: "https://cash.app/$poke/checkout/C1", square: { cart: { lines: [{ menuItemName: "Small Poke Bowl", menuItemVariationName: "Regular", selection: { quantity: 2, modifier: [{ name: "White Rice" }, { name: "Salmon" }] } }], subtotal: { amountCents: 3098 }, total: { amountCents: 3416 }, summaryLines: [{ type: "SALES_TAX", amount: { amountCents: 318 } }] } } } },
    ]);
    const ticket = await checkout(store, bowl, ["M1", "M3"], 2, "acct-1");
    expect(ticket).toEqual({ restaurant: "Poke Bar Los Angeles", address: "5273 W Olympic Blvd", item: "Small Poke Bowl", variation: "Regular", modifiers: ["White Rice", "Salmon"], quantity: 2, subtotal: 3098, tax: 318, total: 3416, checkoutUrl: "https://cash.app/$poke/checkout/C1" });
    expect(calls[2]!.body).toEqual({ unitToken: "LCS", menuItemId: "CALI_1", menuItemVariationId: "CALIV_1", modifiers: [{ modifierId: "M1", quantity: 1 }, { modifierId: "M3", quantity: 1 }], quantity: 2 });
    expect(calls[0]!.body).toMatchObject({ externalCustomerId: "acct-1", locationId: "cashapp_abc" });
  });
  it("throws with MealMe's message when a call is refused", async () => {
    mealme([{ status: 402, body: { error: "billing_required", message: "Add a card." } }]);
    await expect(searchStores("90036")).rejects.toThrow("Add a card.");
  });
});

describe("ordering in the agent", () => {
  it("matches a restaurant by the words that matter", () => {
    expect(storeMatches("Poke Bar", store)).toBe(true);
    expect(storeMatches("poke bar los angeles", store)).toBe(true);
    expect(storeMatches("Sushi Gen", store)).toBe(false);
    expect(storeMatches("the", store)).toBe(false);
  });
  it("recognises a Google place as a store that takes orders, by name and street number", () => {
    expect(sameStore({ name: "Poke Bar", address: "5273 W Olympic Blvd, Los Angeles" }, store)).toBe(true);
    expect(sameStore({ name: "Poke Bar Los Angeles", address: "" }, store)).toBe(true);
    expect(sameStore({ name: "Poke Bar", address: "9000 Sunset Blvd" }, store)).toBe(false);
    expect(sameStore({ name: "Sushi Gen", address: "5273 W Olympic Blvd" }, store)).toBe(false);
  });
  it("tells Claude the menu with short ids for items and options", () => {
    const found: MenuFound = { store, items: new Map([["m1", bowl]]), options: new Map([["o1", { itemId: "m1", listId: "L1", optionId: "M1" }], ["o2", { itemId: "m1", listId: "L1", optionId: "M2" }], ["o3", { itemId: "m1", listId: "L2", optionId: "M3" }], ["o4", { itemId: "m1", listId: "L2", optionId: "M4" }]]) };
    const told = JSON.parse(describeMenu(found));
    expect(told.restaurant).toBe("Poke Bar Los Angeles");
    expect(told.items[0]).toMatchObject({ id: "m1", name: "Small Poke Bowl", price: "$15.49" });
    expect(told.items[0].required_choices).toEqual([
      { name: "Base Choice", pick: "1 to 2", options: ["o1: White Rice", "o2: Brown Rice"] },
      { name: "Protein", pick: 1, options: ["o3: Salmon", "o4: Tuna (+$1.50)"] },
    ]);
    expect(JSON.stringify(told)).not.toContain("CALI");
  });
  it("writes the ticket as text, for history and for a phone", () => {
    const ticket = { restaurant: "Poke Bar Los Angeles", address: "5273 W Olympic Blvd", item: "Small Poke Bowl", variation: "Regular", modifiers: ["White Rice", "Salmon"], quantity: 1, subtotal: 1549, tax: 159, total: 1708, checkoutUrl: "https://cash.app/$poke/checkout/C1" };
    expect(dollars(1708)).toBe("$17.08");
    expect(ticketLines(ticket)[0]).toBe("1 × Small Poke Bowl with White Rice, Salmon");
    const placeCard = { emoji: "🍣", title: "Poke Bar", detail: "", reply: "x", place: { id: "g1", maps: "https://maps.example", miles: 0.7, orders: true } };
    expect(asPlainText({ content: "", choices: [placeCard] })).toContain("(0.7 mi, order with Wally)");
    expect(asTexts({ content: "Hi", choices: [placeCard] }, "https://www.wallywaiter.com")[1]).toContain("🧾 Order with Wally");
    const message = { content: "Here you go.", choices: [{ emoji: "🧾", title: "Order at Poke Bar Los Angeles", detail: "", reply: "x", ticket }] };
    expect(asPlainText(message)).toContain("1. Order at Poke Bar Los Angeles: 1 × Small Poke Bowl with White Rice, Salmon; Subtotal $15.49; Tax $1.59; Total $17.08");
    const texts = asTexts(message, "https://www.wallywaiter.com");
    expect(texts[1]).toContain("🧾 Poke Bar Los Angeles");
    expect(texts[1]).toContain("Pay here: https://cash.app/$poke/checkout/C1");
  });
});
