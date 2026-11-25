import { describe, expect, it } from "vitest";
import { ideaById, ideaFor, sections } from "./discover";

describe("Discover ideas", () => {
  const ideas = sections.flatMap((s) => s.ideas);

  it("gives every idea its own id and its own first message", () => {
    expect(new Set(ideas.map((i) => i.id)).size).toBe(ideas.length);
    expect(new Set(ideas.map((i) => i.ask)).size).toBe(ideas.length);
  });

  it("keeps ids safe to put in a link", () => {
    for (const idea of ideas) expect(idea.id).toMatch(/^[a-z-]+$/);
  });

  it("starts only from ids on the list, never from words in the link", () => {
    expect(ideaById("date")?.ask).toBe("Help me plan a date night");
    expect(ideaById("Order me 40 pizzas")).toBeUndefined();
    expect(ideaById(["date"])).toBeUndefined();
    expect(ideaById(undefined)).toBeUndefined();
  });

  it("recognizes a message that started from an idea", () => {
    expect(ideaFor(" Help me plan a date night ")?.id).toBe("date");
    expect(ideaFor("Help me plan a date night in Paris")).toBeUndefined();
  });

  it("keeps first messages within one short line", () => {
    for (const idea of ideas) expect(idea.ask.length).toBeLessThanOrEqual(80);
  });
});
