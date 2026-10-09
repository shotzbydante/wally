import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, readToken, signToken, type Session } from "./session";

const secret = "s".repeat(32);
const session: Session = { name: "Dante", phone: "3105550142", zip: "90026", suggestions: false, exp: 2000 };

describe("session cookie", () => {
  it("round-trips", () => {
    expect(decodeSession(encodeSession(session, secret), secret, 1500_000)).toEqual(session);
  });
  it("rejects an expired session", () => {
    expect(decodeSession(encodeSession(session, secret), secret, 2000_000)).toBeNull();
  });
  it("rejects a tampered body", () => {
    const [, mac] = encodeSession(session, secret).split(".");
    const forged = Buffer.from(JSON.stringify({ ...session, typ: "session", phone: "2125550100" })).toString("base64url");
    expect(decodeSession(`${forged}.${mac}`, secret, 1500_000)).toBeNull();
  });
  it("rejects another secret and junk", () => {
    expect(decodeSession(encodeSession(session, secret), "x".repeat(32), 1500_000)).toBeNull();
    expect(decodeSession("nonsense", secret)).toBeNull();
    expect(decodeSession(undefined, secret)).toBeNull();
  });
  it("does not accept one kind of token as another", () => {
    const link = signToken("email-link", { email: "a@b.co", exp: 2000 }, secret);
    expect(decodeSession(link, secret, 1500_000)).toBeNull();
    expect(readToken("email-link", link, secret, 1500_000)).toEqual({ email: "a@b.co", exp: 2000 });
  });
});
