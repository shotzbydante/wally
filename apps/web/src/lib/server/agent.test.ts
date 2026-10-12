import { describe, expect, it } from "vitest";
import { asPlainText, splitSources, withSources, type ChatMessage } from "@/lib/chat";
import { readChoices, readWeb, toClaudeMessages } from "./agent";

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
