import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chunks, keywordOf, sameSecret, twilioSignatureValid, usPhone } from "./texting";

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
  it("compares webhook secrets exactly", () => {
    expect(sameSecret("abc", "abc")).toBe(true);
    expect(sameSecret("abd", "abc")).toBe(false);
    expect(sameSecret(null, "abc")).toBe(false);
  });
});
