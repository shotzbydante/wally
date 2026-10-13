import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chunks, connectCode, keywordOf, readConnectCode, sameSecret, twilioSignatureValid, usPhone } from "./texting";

describe("texting", () => {
  it("reads a US number however the provider writes it", () => {
    expect(usPhone("+13105550142")).toBe("3105550142");
    expect(usPhone("(310) 555-0142")).toBe("3105550142");
    expect(usPhone("+447700900123")).toBeNull();
    expect(usPhone("12345")).toBeNull();
    expect(usPhone(undefined)).toBeNull();
  });
  it("knows the carrier keywords, and only when they are the whole message", () => {
    expect(keywordOf(" stop ")).toBe("stop");
    expect(keywordOf("Unsubscribe.")).toBe("stop");
    expect(keywordOf("START")).toBe("start");
    expect(keywordOf("help")).toBe("help");
    expect(keywordOf("stop by the taco place?")).toBeNull();
    expect(keywordOf("yes")).toBeNull();
  });
  it("breaks a long answer into texts at line ends", () => {
    expect(chunks("short")).toEqual(["short"]);
    const long = Array.from({ length: 40 }, (_, i) => `${i + 1}. A place with a fairly long line of description to fill space`).join("\n");
    const parts = chunks(long, 300);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= 300)).toBe(true);
    expect(parts.join("\n")).toBe(long);
  });
  it("accepts only Twilio's own signature for the exact address and fields", () => {
    const url = "https://wallywaiter.com/api/text/twilio";
    const params = { To: "+13105550100", From: "+13105550142", Body: "tacos", MessageSid: "SM1" };
    const signature = createHmac("sha1", "token").update(`${url}Bodytacos` + "From+13105550142MessageSidSM1To+13105550100").digest("base64");
    expect(twilioSignatureValid(url, params, signature, "token")).toBe(true);
    expect(twilioSignatureValid(url, { ...params, Body: "pizza" }, signature, "token")).toBe(false);
    expect(twilioSignatureValid("https://evil.example/api/text/twilio", params, signature, "token")).toBe(false);
    expect(twilioSignatureValid(url, params, "", "token")).toBe(false);
  });
  it("reads its own connect code out of a text, for two days, and nobody else's", () => {
    const id = "3f2c1a9e-7b4d-4e6f-8a1b-2c3d4e5f6a7b";
    const now = Date.UTC(2026, 9, 13, 5);
    const code = connectCode(id, "s".repeat(32), now);
    expect(code).toHaveLength(32);
    expect(readConnectCode(`Hi Wally, connect my phone. Code: ${code}`, "s".repeat(32), now)).toBe(id);
    expect(readConnectCode(`Code: ${code}`, "s".repeat(32), now + 86_400_000)).toBe(id);
    expect(readConnectCode(`Code: ${code}`, "s".repeat(32), now + 3 * 86_400_000)).toBeNull();
    expect(readConnectCode(`Code: ${code}`, "t".repeat(32), now)).toBeNull();
    expect(readConnectCode(`Code: ${code.slice(0, 31)}x`, "s".repeat(32), now)).toBeNull();
    expect(readConnectCode("tacos near me, something supercalifragilisticexpialidocious", "s".repeat(32), now)).toBeNull();
  });
  it("compares webhook secrets exactly", () => {
    expect(sameSecret("abc", "abc")).toBe(true);
    expect(sameSecret("abd", "abc")).toBe(false);
    expect(sameSecret(null, "abc")).toBe(false);
  });
});
