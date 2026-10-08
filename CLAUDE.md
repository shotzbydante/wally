# Wally

Wally is a food-only AI agent you text (iMessage/SMS) with a companion web app. It orders food and books restaurant reservations. The mascot is Wally the Waiter, a chubby mint-green monster in a waiter's outfit.

Read `docs/product-brief.md` before any product or architecture work. It condenses the PRD into the rules the code must enforce. The canonical character art is `assets/character/wally-canonical.png`.

## Layout

- `apps/web` — Next.js (App Router, TypeScript, Tailwind v4). Onboarding, Home, Taste, Wallet & Limits, Ledger. See `apps/web/AGENTS.md`: this Next.js version has breaking changes, read the bundled docs before writing Next code.
- `packages/core` — `@wally/core`. Framework-free domain code: the connector interface (`connector.ts`) and the policy/approval engine (`policy.ts`).
- `docs/` — product brief and decisions.

Planned, not yet built: channel gateway (iMessage bridge, SMS), conversation orchestrator, memory service, payments service, human ops console.

## Commands

Run from the repo root (npm workspaces, Node 22):

- `npm install`
- `npm run dev` — web app at localhost:3000
- `npm test` — vitest
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Run test, typecheck and lint before committing.

## Rules that are not negotiable

These come from the PRD and exist because of real failures at competitors.

1. **Policy is code, not a prompt.** Every write action (charge, order, booking, cancel) goes through `packages/core/src/policy.ts`. The model never decides whether it may spend. Changes to policy need tests.
2. **Ask every time.** Explicit approval of an itemized ticket before any charge or booking. Only the payer approves.
3. **Submit once.** On timeout or unknown outcome, never retry automatically: check status and escalate to a human.
4. **Fail closed** when payments or checkout are degraded.
5. **Limits can't be changed from chat.** Caps and auto-approve are set on the web only.
6. **Cards never touch chat or the model.** Hosted card capture, tokens only.
7. **Connectors only.** All ordering and booking sources sit behind the `OrderingConnector` interface. No provider-specific code outside a connector.
8. **No unauthorized automation.** No scripted access or polling of OpenTable, Resy, DoorDash or any platform without written authorization. Reservations are booked in the diner's real name, one per meal period, never resold or transferred.
9. **Allergy and dietary data** live in a separately consented, separately deletable store.
10. **Wally always identifies as an AI** and never starts a 1:1 thread with a non-member.

## Conventions

- TypeScript strict. Money is integer cents.
- Tickets, confirmations and errors use neutral, exact language. Personality lives elsewhere, and never while money or a problem is on the table.
- Don't use `next/font/google`; the build environment can't reach Google Fonts. Use system fonts or `next/font/local`.
- Never commit secrets. Add new env vars to `.env.example`.
