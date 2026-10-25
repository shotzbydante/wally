import { describe, expect, it } from "vitest";
import { asPlainText, asTexts, textDeliveryLinks, isOwnSite, tidyLink, webNudgeDue, splitSources, withSources, type ChatMessage } from "@/lib/chat";
import { describePlaces, readChoices, readWeb, toClaudeMessages, withHistoryCache, type FoundPlace } from "./agent";

const message = (id: number, role: ChatMessage["role"], content: string, choices: ChatMessage["choices"] = null): ChatMessage => ({
  id,
  role,
  channel: "web",
  content,
  choices,
  created_at: "2026-10-12T00:00:00Z",
});
const ramen = { emoji: "🍜", title: "Ramen", detail: "Rich and warm", reply: "Ramen please" };
const tacos = { emoji: "🌮", title: "Tacos", detail: "", reply: "Tacos" };

describe("asPlainText", () => {
  it("writes options as a numbered list, the way a text thread shows them", () => {
    expect(asPlainText({ content: "Two ideas.", choices: [ramen, tacos] })).toBe("Two ideas.\n1. Ramen: Rich and warm\n2. Tacos");
    expect(asPlainText({ content: "Just words.", choices: null })).toBe("Just words.");
  });
});

describe("toClaudeMessages", () => {
  it("alternates roles, merging messages sent back to back", () => {
    const thread = [message(1, "user", "hi"), message(2, "user", "you there?"), message(3, "assistant", "Two ideas.", [ramen, tacos]), message(4, "user", "1")];
    expect(toClaudeMessages(thread)).toEqual([
      { role: "user", content: "hi\n\nyou there?" },
      { role: "assistant", content: "Two ideas.\n1. Ramen: Rich and warm\n2. Tacos" },
      { role: "user", content: "1" },
    ]);
  });
  it("starts with the person even when the window opens on Wally's turn", () => {
    expect(toClaudeMessages([message(1, "assistant", "Welcome back."), message(2, "user", "hi")])).toEqual([{ role: "user", content: "hi" }]);
  });
});

describe("withHistoryCache", () => {
  const cache = { cache_control: { type: "ephemeral" } };
  it("marks only the last block of the last message, without touching the originals", () => {
    const original = [
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: [{ type: "text" as const, text: "Hello." }] },
      { role: "user" as const, content: [{ type: "tool_result" as const, tool_use_id: "t1", content: "a" }, { type: "text" as const, text: "and" }] },
    ];
    const cached = withHistoryCache(original);
    expect(cached[0]).toEqual({ role: "user", content: "hi" });
    expect(cached[1]).toEqual(original[1]);
    expect(cached[2]).toEqual({ role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "a" }, { type: "text", text: "and", ...cache }] });
    expect(original[2].content[1]).toEqual({ type: "text", text: "and" });
  });
  it("turns a plain-string last message into one cached text block", () => {
    expect(withHistoryCache([{ role: "user", content: "hi" }])).toEqual([{ role: "user", content: [{ type: "text", text: "hi", ...cache }] }]);
    expect(withHistoryCache([])).toEqual([]);
  });
});

describe("readChoices", () => {
  it("keeps well-formed options and fills small gaps", () => {
    expect(readChoices({ choices: [ramen, { title: " Tacos " }] })).toEqual([ramen, { emoji: "🍽️", title: "Tacos", detail: "", reply: "Tacos" }]);
  });
  it("caps the count and the length of each field", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ ...ramen, title: `Option ${i} ${"x".repeat(200)}` }));
    const read = readChoices({ choices: many })!;
    expect(read).toHaveLength(4);
    expect(read[0]!.title.length).toBeLessThanOrEqual(60);
  });
  it("treats anything that isn't at least two options as no choice", () => {
    for (const input of [null, {}, { choices: "ramen" }, { choices: [ramen] }, { choices: [ramen, { title: "" }, null, 7] }]) {
      expect(readChoices(input)).toBeNull();
    }
  });
});

describe("links on options", () => {
  const found = new Set(["bestia.example", "eater.example"]);
  const place = (url: string) => ({ ...ramen, url });
  it("keeps a link only when it is https and points at a site the search returned", () => {
    const read = readChoices(
      { choices: [place("https://www.bestia.example/menu"), place("https://made-up.example/"), place("http://bestia.example/"), place("javascript:alert(1)")] },
      found,
    )!;
    expect(read.map((c) => c.url)).toEqual(["https://www.bestia.example/menu", undefined, undefined, undefined]);
  });
  it("drops every link when nothing was searched", () => {
    expect(readChoices({ choices: [place("https://bestia.example/"), tacos] })!.every((c) => !c.url)).toBe(true);
  });
  it("puts the link after the option in a text thread", () => {
    expect(asPlainText({ content: "", choices: [place("https://bestia.example/"), tacos] })).toBe("1. Ramen: Rich and warm https://bestia.example/\n2. Tacos");
  });
});

describe("sources", () => {
  const sources = [
    { title: "The 38 Best  Restaurants\nin LA", url: "https://eater.example/maps/best" },
    { title: "", url: "https://www.bestia.example/" },
  ];
  it("travel in the text and come back out as links", () => {
    const content = withSources("Two worth the trip.", sources);
    expect(content).toBe("Two worth the trip.\n\nSources:\nThe 38 Best Restaurants in LA https://eater.example/maps/best\nhttps://www.bestia.example/");
    expect(splitSources(content)).toEqual({
      text: "Two worth the trip.",
      sources: [
        { title: "The 38 Best Restaurants in LA", url: "https://eater.example/maps/best" },
        { title: "bestia.example", url: "https://www.bestia.example/" },
      ],
    });
  });
  it("leaves ordinary text alone", () => {
    for (const text of ["No sources here.", "My list.\n\nSources:\nmy grandmother", withSources("Nothing cited.", [])]) {
      expect(splitSources(text)).toEqual({ text, sources: [] });
    }
  });
});

describe("readWeb", () => {
  it("collects cited pages and every page the search returned, once each", () => {
    const cite = (url: string, title: string | null) => ({ type: "web_search_result_location", url, title, cited_text: "…", encrypted_index: "x" });
    const result = (url: string, title: string) => ({ type: "web_search_result", url, title, encrypted_content: "x", page_age: null });
    const blocks = [
      { type: "text", text: "Let me look.", citations: null },
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "affogato" } },
      { type: "web_search_tool_result", tool_use_id: "s1", content: [result("https://a.example/1", "A"), result("https://b.example/2", "B")] },
      { type: "text", text: "A does it well.", citations: [cite("https://a.example/1", "A"), cite("https://a.example/1", "A")] },
      { type: "web_search_tool_result", tool_use_id: "s2", content: { type: "web_search_tool_result_error", error_code: "unavailable" } },
    ] as unknown as Parameters<typeof readWeb>[0];
    expect(readWeb(blocks)).toEqual({
      cited: [{ url: "https://a.example/1", title: "A" }],
      found: [
        { url: "https://a.example/1", title: "A" },
        { url: "https://b.example/2", title: "B" },
      ],
    });
  });
});

describe("a restaurant's own site", () => {
  it("is told apart from its page on a marketplace or social network", () => {
    expect(isOwnSite("https://www.ginospizza.com/order")).toBe(true);
    expect(isOwnSite("https://order.toasttab.com/online/ginos")).toBe(true);
    expect(isOwnSite("https://www.doordash.com/store/ginos-123/")).toBe(false);
    expect(isOwnSite("https://m.facebook.com/ginos")).toBe(false);
    expect(isOwnSite("https://notdoordash.com/")).toBe(true);
    expect(isOwnSite(null)).toBe(false);
    expect(isOwnSite("not a link")).toBe(false);
  });
  it("is flagged for Wally so he can favor places that have one", () => {
    const place = (name: string, website: string | null): FoundPlace => ({ id: name, name, address: "", kind: "", point: null, open: null, rating: null, ratings: null, price: null, website, maps: "https://maps.google.com/?cid=1" });
    const found = new Map([["p1", place("Gino's", "https://ginospizza.com/")], ["p2", place("Chain", "https://www.ubereats.com/store/chain")], ["p3", place("Cart", null)]]);
    const rows = JSON.parse(describePlaces(found, ["p1", "p2", "p3"])) as { own_site?: boolean }[];
    expect(rows.map((r) => r.own_site)).toEqual([true, undefined, undefined]);
  });
});

describe("asTexts", () => {
  const cookies = { emoji: "🍪", title: "Insomnia Cookies", detail: "Open late, warm cookies", reply: "x", place: { id: "a", miles: 2.8, open: true, rating: 4.5, price: "$", website: "https://insomniacookies.com/", maps: "https://maps.google.com/?cid=1" } };
  const closed = { emoji: "🥛", title: "DeLuscious", detail: "", reply: "x", place: { id: "b", miles: 1.1, open: false, maps: "https://maps.google.com/?cid=2" } };
  it("sends his words and the cards as separate texts, a small card per place", () => {
    expect(asTexts({ content: "Insomnia is my pick.", choices: [cookies, closed] }, "https://wallywaiter.com")).toEqual([
      "Insomnia is my pick.",
      "1. 🍪 Insomnia Cookies\nOpen now · 2.8 mi · ★ 4.5 · $\nOpen late, warm cookies\ninsomniacookies.com\n\n2. 🥛 DeLuscious\nClosed · 1.1 mi\nDoorDash: wallywaiter.com/go/doordash/deluscious\nUber Eats: wallywaiter.com/go/ubereats/deluscious\n\nVisit Wally for more options: wallywaiter.com/ask",
    ]);
    expect(asTexts({ content: "Just words.", choices: null }, "https://wallywaiter.com")).toEqual(["Just words."]);
    // Around a spot the person named, the distance says where it is from.
    const byTheater = { ...cookies, place: { ...cookies.place, miles: 0.3, from: "Pantages Theatre" } };
    expect(asTexts({ content: "Close by.", choices: [byTheater] }, "https://wallywaiter.com")[1]).toContain("Open now · 0.3 mi from Pantages Theatre · ★ 4.5 · $");
    expect(asPlainText({ content: "Close by.", choices: [byTheater] })).toContain("(0.3 mi from Pantages Theatre, open)");
    expect(asTexts({ content: "Two ideas.", choices: [ramen, tacos] }, "https://wallywaiter.com")).toEqual(["Two ideas.", "1. 🍜 Ramen\nRich and warm\n\n2. 🌮 Tacos\n\nVisit Wally for more options: wallywaiter.com/ask"]);
    expect(asTexts({ content: "", choices: [ramen, tacos] }, "https://wallywaiter.com", true)[0]).toMatch(/wallywaiter\.com\/ask\nIt's this same conversation, always in sync with our texts\.$/);
  });
  it("writes delivery links a text can carry", () => {
    expect(textDeliveryLinks("Lei’d Cookies & Café", "https://wallywaiter.com").map((l) => l.url)).toEqual(["wallywaiter.com/go/doordash/leid-cookies-cafe", "wallywaiter.com/go/ubereats/leid-cookies-cafe"]);
    expect(textDeliveryLinks("麺", "https://wallywaiter.com")).toEqual([]);
  });
  it("shortens a plain link and leaves the rest alone", () => {
    expect(tidyLink("http://www.delusciouscookies.com/")).toBe("delusciouscookies.com");
    expect(tidyLink("https://bestia.example/menu/?utm_source=google")).toBe("bestia.example/menu");
    expect(tidyLink("https://bestia.example/order?store=4")).toBe("https://bestia.example/order?store=4");
    expect(tidyLink("not a link")).toBe("not a link");
  });
  it("points to the website on his first text, then only after a quiet week", () => {
    const now = Date.parse("2026-10-13T06:00:00Z");
    const said = (channel: "web" | "text", created_at: string) => ({ role: "assistant" as const, channel, created_at });
    expect(webNudgeDue([], now)).toBe(true);
    expect(webNudgeDue([said("web", "2026-10-13T05:00:00Z")], now)).toBe(true);
    expect(webNudgeDue([said("text", "2026-10-12T05:00:00Z")], now)).toBe(false);
    expect(webNudgeDue([said("text", "2026-10-01T05:00:00Z")], now)).toBe(true);
  });
});
