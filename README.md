# Wally

A fun-loving AI food ordering assistant. Text Wally to order food or book a table; a web app handles sign-up, cards, limits and the activity ledger.

<img src="assets/character/wally-canonical.png" alt="Wally the Waiter" width="240">

## Getting started

Requires Node 22.

```sh
npm install
npm run dev        # http://localhost:3000
npm test
```

## Structure

| Path | What |
|---|---|
| `apps/web` | Next.js web app |
| `packages/core` | Connector interface and policy/approval engine |
| `docs/product-brief.md` | Product requirements, condensed |
| `CLAUDE.md` | Project guide for Claude Code |

Status: scaffold only. Nothing is wired to a real provider yet.
