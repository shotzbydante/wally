/**
 * Policy and approval engine. Deterministic code that sits between the
 * model and every write action. It is NOT a prompt and the model cannot
 * loosen it (AP-1..AP-7, OR-5, OR-6, GC-6).
 */
import type { Quote } from "./connector";

export interface Approval {
  quoteId: string;
  /** Total the user actually saw and approved. */
  approvedTotal: number;
  approvedBy: string;
  approvedAt: string;
}

export interface SubmitContext {
  quote: Quote;
  /** The one user allowed to pay for this transaction (GC-6). */
  payerId: string;
  approval?: Approval;
  /** Kill switch (AP-5). */
  paused: boolean;
  /** Payments/checkout health (AP-7): fail closed. */
  paymentsHealthy: boolean;
  /** True if a submit for this quote was already attempted (OR-6). */
  alreadySubmitted: boolean;
  now: Date;
}

export type Decision =
  | { allow: true }
  | { allow: false; code: DenyCode; message: string };

export type DenyCode =
  | "paused"
  | "payments_degraded"
  | "already_submitted"
  | "not_approved"
  | "wrong_approver"
  | "quote_expired"
  | "total_changed";

const deny = (code: DenyCode, message: string): Decision => ({ allow: false, code, message });

/** Write actions are denied by default; this is the only way to get a yes. */
export function canSubmit(ctx: SubmitContext): Decision {
  const { quote, approval } = ctx;
  if (ctx.paused) return deny("paused", "Wally is paused.");
  if (!ctx.paymentsHealthy) return deny("payments_degraded", "Checkout is degraded; not transacting.");
  if (ctx.alreadySubmitted)
    return deny("already_submitted", "Already submitted once; check status and escalate, never retry.");
  if (!approval || approval.quoteId !== quote.id)
    return deny("not_approved", "No approval for this quote.");
  if (approval.approvedBy !== ctx.payerId)
    return deny("wrong_approver", "Only the payer can approve.");
  if (ctx.now.getTime() >= new Date(quote.expiresAt).getTime())
    return deny("quote_expired", "Quote expired; re-quote and re-confirm.");
  if (approval.approvedTotal !== quote.total)
    return deny("total_changed", "Total changed since approval; re-confirm.");
  return { allow: true };
}
