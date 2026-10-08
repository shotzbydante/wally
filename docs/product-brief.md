# Wally product brief

Condensed from the full PRD ("Wally: the food agent you text", October 2026), which lives in the Wally project on claude.ai. The PRD has the research, sources and reasoning; this file has what the build needs.

## Product

A cross-platform, food-only texting agent. The user texts Wally over iMessage (SMS fallback); a web app handles sign-up, cards, limits and the ledger. Launch proposal: one or two dense metros (Los Angeles, New York), iPhone first.

Core use cases: reorder a usual, craving to cart, cross-platform price comparison, direct order, group order, book a table, table watch, group dinner planning, manage an order or booking.

## Constraints that shape the build

- **No open API exists** for marketplace ordering or OpenTable/Resy booking. Every sanctioned route is a waitlist, partnership or hand-off, so everything sits behind a swappable connector layer.
- **Polling a user's reservation account gets users banned** (Resy, September 2026), and OpenTable's terms ban unauthorized AI access. Table Watch uses release-day coaching, native waitlists, disclosed AI phone calls and partner inventory. No polling.
- **iMessage group chats** are only reachable through unofficial bridge providers, which carry Apple ban risk.
- **The name "Wally" is not cleared** (Walmart's assistant, WALL-E). Keep the name easy to change: no hard-coding beyond config and copy.

## Requirements by priority

### P0 (MVP)

Onboarding
- ON-1 Web sign-up collects name, mobile, ZIP; the user sends the first text from a deep link.
- ON-2 Wally replies with a contact card and identifies as an AI in the first message.
- ON-3 Transactional texts by default; proactive suggestions are a separate, unticked opt-in; STOP and HELP work everywhere.
- ON-4 Cards and addresses are entered only on a hosted page via an expiring link, never in chat.
- ON-5 Taste profile in at most five questions; allergies and dietary needs are a separate explicit opt-in.
- ON-7 Invite links carry the inviter's first name and grant access, not cash.

Ordering
- OR-1 Free text, photos and screenshots to at most three options with photo, price, ETA.
- OR-2 Cart with modifiers; allergy notes passed to the restaurant with a no-guarantee disclaimer.
- OR-3 One ticket before commit: subtotal, delivery fee, service fee, tax, tip, total, ETA, source, payment last-4.
- OR-4 Explicit approval for every order.
- OR-5 If the price changes or the quote ages out (about ten minutes), re-quote and re-confirm.
- OR-6 Single submit; on timeout or unknown outcome never retry, check status, escalate to a human.
- OR-7 Tracking, delay and substitution messages in thread.
- OR-10 Problem handling routed to the fulfilling party, with a human available.

Reservations
- RS-1 Search by party size, time window, area, cuisine, vibe.
- RS-2 Book in the diner's real name and number.
- RS-3 Show exact deposit, hold, prepayment and cancellation terms and require confirmation.
- RS-4 One reservation per user per meal period.
- RS-5 Calendar hold, reminders at 24h and 2h, one-tap cancel before the cutoff.
- RS-6 Modify and cancel through the booking channel.
- RS-7 Without a sanctioned path: deep link to the platform or a disclosed AI phone call.

Approvals
- AP-1 Ask every time for every charge and booking.
- AP-3 Web step-up for a new address, new card, large order, or any booking with a fee.
- AP-4 Limits cannot be raised from a conversation.
- AP-5 "Pause Wally" kill switch by text and web.
- AP-6 Full web ledger of every quote, approval, charge, refund, booking.
- AP-7 When payments or checkout are degraded, decline to transact and say so.

### P1

- Usuals with auto-approve under user-set per-order and weekly caps, set on the web (OR-8, AP-2).
- Cross-source all-in price comparison (OR-9).
- Authorized account links (ON-6).
- Group chats: a member adds Wally; a siloed "Table Wally" per thread with no access to members' private data; announces itself as an AI once; speaks only when addressed; polls for consensus; exactly one payer, ticket goes to the payer's 1:1 thread; never starts a 1:1 with a non-member (GC-1 to GC-7, GC-9).
- Table Watch (TW-1 to TW-10): a watch is one restaurant, party size, date range and window for one named diner. Release-day coaching with a deep link, native waitlist relay, disclosed phone calls, partner inventory under written agreement. No per-reservation fee, no transfer, no listing of tables. Repeated no-shows suspend the feature.

### P2

- After-the-fact splits via payment links (GC-8).

## Architecture

Seven components:

1. **Channel gateway** — normalizes iMessage bridge, SMS/RCS, web chat and voice into one event stream; three-second debounce; per-line send limits.
2. **Conversation orchestrator** — one personal agent per user, one siloed agent per group thread.
3. **Memory service** — taste profile, Usuals, history; allergy data separately consented and deletable.
4. **Policy and approval engine** — deterministic code between the model and every write action.
5. **Connector layer** — one interface (search, menu, quote, place, track, cancel) per source: protocol endpoint, aggregator API, account link, deep link, phone call, browser.
6. **Payments service** — holds tokens only; scoped credentials per approved transaction.
7. **Human ops console** — escalations.

Initial integration plan: MealMe aggregator as the primary ordering path (pending pricing and coverage diligence), deep-link hand-off elsewhere; reservation search with deep link and phone-call booking; iMessage via a bridge provider with Twilio SMS fallback; Stripe hosted card capture.

## Character and voice

Wally never interrupts uninvited, visibly remembers, and stays in the dining room. Short messages, one idea each, warm and a little theatrical, at most one flourish per exchange. No jokes while money or a problem is on the table. Tickets, confirmations and errors are neutral and exact.

Web surfaces: Home, Taste, Wallet & Limits, Ledger. Generous white space, one warm accent drawn from Wally's uniform, a rounded display face with a neutral text face, the ticket styled like a restaurant check. Wally appears at one size in one place per screen. Interactive character target: a Rive state machine with about eight states (idle, listening, thinking, presenting, awaiting approval, success, apology, off-duty).

## Roadmap

- **Phase 0, de-risk:** trademark clearance, counsel, partner applications, aggregator and bridge diligence.
- **Phase 1, MVP private beta, one metro:** 1:1 iMessage with SMS fallback; web onboarding, wallet, ledger; aggregator ordering plus hand-offs; reservation search with deep link and phone booking; ask-every-time approvals; human escalation.
- **Phase 2:** groups, Table Watch, Usuals, paid tier, referrals.
- **Phase 3:** partner booking, restaurant-direct agreements, second metro, Android.

Beta targets (proposals): 90% of orders without human intervention, under 1% wrong or duplicate orders, zero unapproved charges, under 3 minutes from first message to approved ticket, zero platform or line bans.
