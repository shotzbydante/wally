import { describe, expect, it } from "vitest";
import { cleanFirstName, firstTextLink, formatUsPhone, isFirstName, isZip, normalizeUsPhone } from "./signup";

describe("normalizeUsPhone", () => {
  it("accepts common formats", () => {
    expect(normalizeUsPhone("(310) 555-0142")).toBe("3105550142");
    expect(normalizeUsPhone("+1 310.555.0142")).toBe("3105550142");
  });
  it("rejects short, long and invalid numbers", () => {
    expect(normalizeUsPhone("310555014")).toBeNull();
    expect(normalizeUsPhone("23105550142")).toBeNull();
    expect(normalizeUsPhone("0105550142")).toBeNull();
    expect(normalizeUsPhone("3101550142")).toBeNull();
  });
});

describe("formatUsPhone", () => {
  it("formats progressively", () => {
    expect(formatUsPhone("310")).toBe("310");
    expect(formatUsPhone("31055")).toBe("(310) 55");
    expect(formatUsPhone("13105550142")).toBe("(310) 555-0142");
  });
});

describe("isZip / isFirstName", () => {
  it("validates ZIP", () => {
    expect(isZip("90026")).toBe(true);
    expect(isZip("9002")).toBe(false);
    expect(isZip("9002a")).toBe(false);
  });
  it("validates names", () => {
    expect(isFirstName("Dante")).toBe(true);
    expect(isFirstName("Mary-Jo")).toBe(true);
    expect(isFirstName("  ")).toBe(false);
    expect(isFirstName("x1")).toBe(false);
  });
});

describe("cleanFirstName", () => {
  it("capitalizes all-lowercase names and leaves others alone", () => {
    expect(cleanFirstName("  dante ")).toBe("Dante");
    expect(cleanFirstName("McKenna")).toBe("McKenna");
  });
});

describe("firstTextLink", () => {
  it("pre-fills the first text", () => {
    expect(firstTextLink("+13105550142")).toBe("sms:+13105550142?&body=Hi%20Wally");
  });
});
