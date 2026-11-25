import { afterEach, describe, expect, it, vi } from "vitest";
import { EMAIL_LINK_MINUTES, signInEmail, siteOrigin } from "./email";

describe("sign-in email", () => {
  afterEach(() => vi.unstubAllEnvs());
  const link = "https://www.wallywaiter.com/api/auth/email/callback?token=a.b&next=/ask";

  it("says the same thing in both parts, and how long the link works", () => {
    const m = signInEmail(link, false, "https://www.wallywaiter.com");
    expect(m.subject).toBe("Your Wally sign-in link");
    expect(m.text).toContain(link);
    expect(m.text).toContain(`${EMAIL_LINK_MINUTES} minutes`);
    expect(m.html).toContain(`It works for ${EMAIL_LINK_MINUTES} minutes.`);
    expect(m.html).toContain("Sign in to Wally");
  });

  it("escapes the link in the HTML part", () => {
    const m = signInEmail(link, false, "https://www.wallywaiter.com");
    expect(m.html).toContain("token=a.b&amp;next=/ask");
    expect(m.html).not.toContain("token=a.b&next");
    const hostile = signInEmail('https://x.test/"><script>alert(1)</script>', false, "https://www.wallywaiter.com");
    expect(hostile.html).not.toContain("<script>");
  });

  it("says what a linking email will do", () => {
    const m = signInEmail(link, true, "https://www.wallywaiter.com");
    expect(m.subject).toBe("Add this email to your Wally account");
    expect(m.text).toContain("add this email address to that account");
    expect(m.html).toContain("Add this email");
  });

  it("loads the brand badge from the public site", () => {
    expect(signInEmail(link, false, "https://www.wallywaiter.com").html).toContain('src="https://www.wallywaiter.com/brand/wally-badge-email.png"');
  });

  it("uses APP_URL only when it is an https origin", () => {
    vi.stubEnv("APP_URL", "https://www.wallywaiter.com/");
    expect(siteOrigin()).toBe("https://www.wallywaiter.com");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(siteOrigin()).toBe("https://www.wallywaiter.com");
    vi.stubEnv("APP_URL", "");
    expect(siteOrigin()).toBe("https://www.wallywaiter.com");
  });
});
