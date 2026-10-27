import { describe, expect, it } from "vitest";
import { chainMenuFor, describeChainMenu } from "./index";
import { mcdonalds } from "./mcdonalds";

describe("kept chain menus", () => {
  it("finds McDonald's menu by any spelling of a listing's name, and nothing for an independent", () => {
    expect(chainMenuFor("McDonald's")?.chain).toBe("McDonald's");
    expect(chainMenuFor("McDonalds Hollywood Blvd")?.chain).toBe("McDonald's");
    expect(chainMenuFor("Tacos El Gordo")).toBeUndefined();
    expect(chainMenuFor("Wendy's")).toBeUndefined();
  });
  it("is the national menu, from mcdonalds.com, with no prices in it", () => {
    const items = mcdonalds.categories.flatMap((c) => c.items);
    expect(items.length).toBeGreaterThan(100);
    expect(mcdonalds.source).toMatch(/^https:\/\/www\.mcdonalds\.com\//);
    expect(mcdonalds.asOf).toMatch(/^\d{4}-\d{2}$/);
    for (const item of items) {
      expect(item.name).toBeTruthy();
      expect(item.description).toMatch(/\w/);
      // Program names like "Under $3 Menu" are McDonald's own; an item price would be a figure with cents.
      expect(JSON.stringify(item)).not.toMatch(/\$\d+\.\d{2}/);
      if (item.calories !== undefined) expect(item.calories).toBeGreaterThanOrEqual(0);
    }
    const names = items.map((i) => i.name);
    for (const name of ["Big Mac", "Quarter Pounder with Cheese", "Chicken McNuggets", "World Famous Fries", "Egg McMuffin", "Filet-O-Fish", "OREO McFlurry"]) expect(names.some((n) => n.startsWith(name))).toBe(true);
  });
  it("answers a question with the matching items first, then everything else by name", () => {
    const told = JSON.parse(describeChainMenu(mcdonalds, "quarter pounder with cheese and fries")) as { restaurant: string; notes: string[]; matches: string[]; everything_else: string[] };
    expect(told.restaurant).toBe("McDonald's");
    expect(told.matches[0]).toMatch(/^\[Burgers\] Quarter Pounder with Cheese \(\d+ cal\): A quarter pound of fresh beef/);
    expect(told.matches.some((m) => /World Famous Fries/.test(m) && /Sizes: /.test(m))).toBe(true);
    expect(told.matches.length).toBeLessThanOrEqual(12);
    expect(told.everything_else.some((line) => line.startsWith("Breakfast: "))).toBe(true);
    expect(told.notes.some((n) => /Breakfast is served/.test(n))).toBe(true);
    expect(told.notes.some((n) => /Prices vary by restaurant/.test(n))).toBe(true);
  });
  it("gives the whole menu when nothing in particular was asked", () => {
    const told = JSON.parse(describeChainMenu(mcdonalds)) as { menu: { category: string; items: string[] }[] };
    expect(told.menu.map((c) => c.category)).toContain("Burgers");
    expect(told.menu.find((c) => c.category === "Burgers")!.items.some((i) => i.startsWith("Big Mac ("))).toBe(true);
    // Compact enough to hand to the model whole.
    expect(JSON.stringify(told).length).toBeLessThan(40_000);
  });
});
