import { afterEach, describe, expect, it, vi } from "vitest";
import { appHost, assetsHost } from "@/lib/analytics-shared";
import type { Choice } from "@/lib/chat";
import { answerShape, flushAnalytics, isPreview, queryText, track, viaOf } from "./analytics";

const place = (over: Partial<NonNullable<Choice["place"]>> = {}): Choice => ({
  emoji: "🍔",
  title: "Irv's Burgers",
  detail: "",
  reply: "Irv's Burgers",
  place: { id: "p1", maps: "https://maps.google.com/?cid=1", ...over } as NonNullable<Choice["place"]>,
});

describe("analytics", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does nothing, and never throws, when PostHog isn't configured", async () => {
    expect(() => track("0b0e7c57-0000-4000-8000-000000000001", "message_sent", { channel: "web" })).not.toThrow();
    expect(() => track(null, "text_link_opened")).not.toThrow();
    await expect(flushAnalytics()).resolves.toBeUndefined();
  });

  it("keeps what people ask out unless it is switched on, and then only the opening", () => {
    expect(queryText("  best pad thai\n near me ")).toEqual({ chars: 21 });
    vi.stubEnv("WALLY_ANALYTICS_QUERIES", "1");
    expect(queryText("  best pad thai\n near me ")).toEqual({ chars: 21, query: "best pad thai near me" });
    const long = queryText("x".repeat(900));
    expect(long.chars).toBe(900);
    expect((long.query as string).length).toBe(280);
  });

  it("only accepts the ways of sending it knows", () => {
    expect(viaOf("starter")).toBe("starter");
    expect(viaOf("fast_food")).toBe("fast_food");
    expect(viaOf("<script>")).toBe("typed");
    expect(viaOf(undefined)).toBe("typed");
  });

  it("describes an answer in counts, never in words", () => {
    expect(answerShape(null)).toMatchObject({ answer: "words", cards: 0, place_cards: 0 });
    const cards = [
      place({ website: "https://irvsburgers.com", orders: true }),
      place({ id: "p2", website: "https://www.doordash.com/store/x", chain: { name: "McDonald's", domain: "mcdonalds.com", driveThru: "usually" } }),
      // Carried data rides on the message but is not a card.
      { emoji: "", title: "", detail: "", reply: "", aside: { closed: 3 } },
    ];
    const shape = answerShape(cards);
    expect(shape).toMatchObject({ answer: "places", cards: 2, place_cards: 2, orderable_cards: 1, own_site_cards: 1, chain_cards: 1, menu_carried: false });
    expect(JSON.stringify(shape)).not.toContain("Irv");

    const ticket: Choice = { emoji: "🧾", title: "Order", detail: "", reply: "", ticket: { restaurant: "Irv's", address: "", item: "Burger", variation: "", modifiers: [], quantity: 2, subtotal: 2000, tax: 190, total: 2190, checkoutUrl: "https://example.com/pay" } };
    expect(answerShape([ticket])).toMatchObject({ answer: "ticket", ticket_total_cents: 2190, ticket_quantity: 2 });
    expect(answerShape([{ emoji: "🍜", title: "Ramen", detail: "", reply: "Ramen" }])).toMatchObject({ answer: "options", cards: 1 });
  });

  it("tells a link preview from a person tapping", () => {
    const from = (agent: string) => new Request("https://wallywaiter.com/m/abc", { headers: { "user-agent": agent } });
    expect(isPreview(from("facebookexternalhit/1.1 Facebot Twitterbot/1.0"))).toBe(true);
    expect(isPreview(from("Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1"))).toBe(false);
  });

  it("works out PostHog's other addresses from the one events go to", () => {
    expect(appHost("https://us.i.posthog.com/")).toBe("https://us.posthog.com");
    expect(assetsHost("https://eu.i.posthog.com")).toBe("https://eu-assets.i.posthog.com");
    // Anything that isn't PostHog Cloud is one address for everything.
    expect(appHost("https://ph.example.com")).toBe("https://ph.example.com");
    expect(assetsHost("https://ph.example.com")).toBe("https://ph.example.com");
  });
});
