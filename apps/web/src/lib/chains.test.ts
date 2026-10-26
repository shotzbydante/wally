import { describe, expect, it } from "vitest";
import { FAST_FOOD_LINE, asTexts, fastFoodAsk, offersFastFood } from "@/lib/chat";
import { CHAINS, chainOf } from "./chains";

describe("chains", () => {
  it("recognises the big chains by a listing's name, spelling aside", () => {
    expect(chainOf("McDonald's")?.name).toBe("McDonald's");
    expect(chainOf("McDonalds")?.name).toBe("McDonald's");
    expect(chainOf("Mc Donald’s Hollywood")?.name).toBe("McDonald's");
    expect(chainOf("Chick-fil-A")?.domain).toBe("chick-fil-a.com");
    expect(chainOf("In-N-Out Burger")?.driveThru).toBe("usually");
    expect(chainOf("Starbucks Reserve")?.driveThru).toBe("sometimes");
    expect(chainOf("Panera Bread")?.name).toBe("Panera Bread");
    expect(chainOf("Dunkin'")?.name).toBe("Dunkin'");
    expect(chainOf("Raising Cane's Chicken Fingers")?.name).toBe("Raising Cane's");
    expect(chainOf("Subway")?.driveThru).toBe("rarely");
  });
  it("leaves independents alone, even ones named like a chain's word", () => {
    expect(chainOf("Tacos El Gordo")).toBeUndefined();
    expect(chainOf("Sonic Youth Cafe")).toBeUndefined();
    expect(chainOf("The Burger Kingdom")).toBeUndefined();
    expect(chainOf("Habitual Coffee")).toBeUndefined();
  });
  it("has a site for every chain, for its icon", () => {
    for (const c of CHAINS) expect(c.domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
  });
});

describe("offering fast food next", () => {
  const card = (title: string, chain?: boolean, from?: string) => ({ emoji: "🍔", title, detail: "", reply: "x", place: { id: title, maps: "https://maps.example", miles: 1, ...(from ? { from } : {}), ...(chain ? { chain: chainOf(title)! } : {}) } });
  it("is offered under sit-down or independent cards, not under an answer that is already fast food", () => {
    expect(offersFastFood([card("Tacos El Gordo"), card("For the Win")])).toBe(true);
    expect(offersFastFood([card("Tacos El Gordo"), card("McDonald's", true)])).toBe(true);
    expect(offersFastFood([card("McDonald's", true), card("Taco Bell", true)])).toBe(false);
    expect(offersFastFood([{ emoji: "🍜", title: "Ramen", detail: "", reply: "x" }])).toBe(false);
    expect(offersFastFood(null)).toBe(false);
  });
  it("asks around the same spot the cards were found", () => {
    expect(fastFoodAsk([card("Tacos El Gordo", false, "Pantages Theatre")])).toBe("Show me fast food and drive-thru options near Pantages Theatre");
    expect(fastFoodAsk([card("Tacos El Gordo")])).toBe("Show me fast food and drive-thru options near me");
  });
  it("is one line in a text, above the link to the site", () => {
    const texts = asTexts({ content: "Here you go.", choices: [card("Tacos El Gordo")] }, "https://wallywaiter.com");
    expect(texts[1]).toContain(`\n\nWant to see places that aren't open right now too? Just say so.\n${FAST_FOOD_LINE}\nVisit Wally for more options:`);
    expect(asTexts({ content: "Here you go.", choices: [card("McDonald's", true)] }, "https://wallywaiter.com")[1]).not.toContain(FAST_FOOD_LINE);
  });
});
