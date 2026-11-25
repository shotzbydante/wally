import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "@/lib/server/session";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const link = (exp: number) => `https://www.wallywaiter.com/api/auth/email/callback?token=${encodeURIComponent(signToken("email-link", { email: "a@example.com", exp }, SECRET))}`;

describe("opening an emailed sign-in link", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("APP_URL", "https://www.wallywaiter.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("serves a page with a button and spends nothing: a mail app's fetch must not use the link up", async () => {
    const fetched = vi.spyOn(globalThis, "fetch");
    const res = await GET(new Request(link(Math.floor(Date.now() / 1000) + 600)));
    expect(res.status).toBe(200);
    const page = await res.text();
    expect(page).toContain('<form method="post"');
    expect(page).not.toContain("<script");
    expect(res.headers.get("cache-control")).toBe("no-store");
    // No database call, so nothing was claimed.
    expect(fetched).not.toHaveBeenCalled();
    fetched.mockRestore();
  });

  it("sends an expired or forged link back to sign-in", async () => {
    for (const url of [link(1), "https://www.wallywaiter.com/api/auth/email/callback?token=nope"]) {
      const res = await GET(new Request(url));
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("https://www.wallywaiter.com/signin?error=link_expired");
    }
  });
});
