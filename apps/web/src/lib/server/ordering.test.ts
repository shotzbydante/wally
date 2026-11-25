import { describe, expect, it } from "vitest";
import { nameMatches, sameStore } from "./ordering";

describe("matching a name to a listing", () => {
  it("matches word by word, loosely", () => {
    expect(nameMatches("Marlowe", "Marlowe Coffee & Eatery")).toBe(true);
    expect(nameMatches("Kai Sushi", "Kaido Sushi")).toBe(true);
  });

  it("ignores how a name is split into words", () => {
    expect(nameMatches("Di Cicco's", "DiCicco's Italian Restaurant - Shields")).toBe(true);
    expect(nameMatches("DiCicco's", "Di Cicco's Italian Restaurant")).toBe(true);
    expect(nameMatches("Di Cicco's Restaurant", "DiCicco's")).toBe(true);
    expect(nameMatches("Go Get Em", "GoGetEm Tiger")).toBe(true);
  });

  it("still tells different places apart", () => {
    expect(nameMatches("Di Cicco's", "Me-N-Ed's Pizza")).toBe(false);
    expect(nameMatches("Marlowe", "Bavel")).toBe(false);
    // Run together, a short name isn't matched inside a longer one.
    expect(nameMatches("Al", "Alfred Coffee")).toBe(false);
  });

  it("keeps two branches apart by street number", () => {
    expect(sameStore({ name: "Di Cicco's", address: "6407 E Shields Ave" }, { name: "DiCicco's Italian Restaurant", address: "144 N Blackstone Ave" })).toBe(false);
    expect(sameStore({ name: "Di Cicco's", address: "6407 E Shields Ave" }, { name: "DiCicco's Italian Restaurant", address: "6407 E Shields Ave, Fresno" })).toBe(true);
  });
});
