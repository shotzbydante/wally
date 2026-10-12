import { describe, expect, it } from "vitest";
import { asPlainText, type ChatMessage } from "@/lib/chat";
import { readChoices, toClaudeMessages } from "./agent";

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
