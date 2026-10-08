import { describe, expect, it } from "vitest";
import { canSubmit, type SubmitContext } from "./policy";
import type { Quote } from "./connector";

const quote: Quote = {
  id: "q1",
  connectorId: "test",
  venue: { id: "v1", name: "Thai Place" },
  items: [],
  subtotal: 2000,
  deliveryFee: 299,
  serviceFee: 200,
  tax: 190,
  tip: 400,
  total: 3089,
  expiresAt: "2026-01-01T00:10:00Z",
};

const ok: SubmitContext = {
  quote,
  payerId: "u1",
  approval: { quoteId: "q1", approvedTotal: 3089, approvedBy: "u1", approvedAt: "2026-01-01T00:01:00Z" },
  paused: false,
  paymentsHealthy: true,
  alreadySubmitted: false,
  now: new Date("2026-01-01T00:02:00Z"),
};

const code = (over: Partial<SubmitContext>) => {
  const d = canSubmit({ ...ok, ...over });
  return d.allow ? "allow" : d.code;
};

describe("canSubmit", () => {
  it("allows an approved, fresh, unchanged quote", () => expect(code({})).toBe("allow"));
  it("denies without approval", () => expect(code({ approval: undefined })).toBe("not_approved"));
  it("denies approval for another quote", () =>
    expect(code({ approval: { ...ok.approval!, quoteId: "q2" } })).toBe("not_approved"));
  it("denies a non-payer approver", () =>
    expect(code({ approval: { ...ok.approval!, approvedBy: "u2" } })).toBe("wrong_approver"));
  it("denies an expired quote", () =>
    expect(code({ now: new Date("2026-01-01T00:10:00Z") })).toBe("quote_expired"));
  it("denies when the total changed", () =>
    expect(code({ quote: { ...quote, total: 3189 } })).toBe("total_changed"));
  it("never retries", () => expect(code({ alreadySubmitted: true })).toBe("already_submitted"));
  it("honors the kill switch", () => expect(code({ paused: true })).toBe("paused"));
  it("fails closed when payments are degraded", () =>
    expect(code({ paymentsHealthy: false })).toBe("payments_degraded"));
});
