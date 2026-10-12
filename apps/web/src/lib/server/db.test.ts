import { afterEach, describe, expect, it, vi } from "vitest";
import { dbConfig } from "./db";

afterEach(() => vi.unstubAllEnvs());

describe("dbConfig", () => {
  it.each(["https://abc.supabase.co", "https://abc.supabase.co/", "https://abc.supabase.co/rest/v1", " https://abc.supabase.co/rest/v1/ "])(
    "reads the project URL from %j",
    (value) => {
      vi.stubEnv("SUPABASE_URL", value);
      vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
      expect(dbConfig()).toEqual({ url: "https://abc.supabase.co", key: "sb_secret_x" });
    },
  );
  it("is off without both values", () => {
    vi.stubEnv("SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(dbConfig()).toBeNull();
  });
});
