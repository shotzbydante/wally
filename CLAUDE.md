# Wally

Wally is a food-only AI agent you text (iMessage/SMS) with a companion web app. It orders food and books restaurant reservations. The mascot is Wally the Waiter, a chubby mint-green monster in a waiter's outfit.

Read `docs/product-brief.md` before any product or architecture work. It condenses the PRD into the rules the code must enforce. The canonical character art is `assets/character/wally-canonical.png`.

## Layout

- `apps/web` — Next.js (App Router, TypeScript, Tailwind v4). Onboarding, Home, Taste, Wallet & Limits, Ledger. See `apps/web/AGENTS.md`: this Next.js version has breaking changes, read the bundled docs before writing Next code.
- `packages/core` — `@wally/core`. Framework-free domain code: the connector interface (`connector.ts`) and the policy/approval engine (`policy.ts`).
- `docs/` — product brief and decisions.
- `supabase/migrations` — the database schema, as SQL. `supabase/migrations.test.ts` runs it in an in-process Postgres (PGlite).

Planned, not yet built: channel gateway (iMessage bridge, SMS), memory service, payments service, human ops console. The conversation orchestrator exists in its first form: see "Ask Wally and the agent".

## Commands

Run from the repo root (npm workspaces, Node 22):

- `npm install`
- `npm run dev` — web app at localhost:3000
- `npm test` — vitest
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Run test, typecheck and lint before committing.

## Deploy and CI

- Hosting is Vercel. The Vercel project's Root Directory is `apps/web`; config is in `apps/web/vercel.json`. Pushes to `main` deploy to production, other branches get preview deployments.
- GitHub Actions (`.github/workflows/ci.yml`) runs test, typecheck, lint and build on every push to `main` and every pull request.
- Environment variables are set in the Vercel project settings, mirrored in `.env.example`.

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

## Web design

- Tokens live in `apps/web/src/app/globals.css`: cool paper background, vest-navy ink, green accents, all drawn from the character art. One typeface, Google Sans (open-licensed, OFL), self-hosted via `@fontsource-variable/google-sans`.
- Positioning runs through all copy: Wally gives the diner every option in one place (delivery apps and restaurants' own sites) and puts local restaurants and their own sites first. Show it, don't argue it: no naming or knocking a delivery app, no talk of fees. See "Positioning" in `docs/product-brief.md`.
- Wally speaks in the first person on the landing page, in onboarding and in Ask Wally ("Hi, I'm Wally, your personal waiter. What can I serve up for you today?").
- Wally renders through `src/components/Wally.tsx`. The page background must stay `--paper`, which matches the image backdrop.
- Where there is only room for his face (the strip above the conversation on a phone), use `src/components/WallyFace.tsx`: a drawn face with a `look` prop (smile, glances, wink, delight, thinking, talking, sorry). `AskWally` picks the look from what he is doing and rotates idle looks, so he never holds one expression.
- Gradients are classes in `globals.css` (`fill-green`, `fill-ink`, `tile`, `card`, `composer`, `dock`, `aura`), kept subtle. White text on `fill-green` must stay above 4.5:1.
- A place answer must fit four cards on a phone screen at once, between the sticky strip and the message box. Keep place cards compact (about 113px each) and one per row.
- Onboarding is `/join` (`src/components/JoinFlow.tsx`): name, mobile and ZIP, text consent, then a 6-digit code. Wally speaks each step in a speech bubble and the form is a plain white card.
- Verification: `/api/verify/start` and `/api/verify/check` call Twilio Verify (`src/lib/server/verify.ts`). On success a signed, httpOnly session cookie is set (`src/lib/server/session.ts`) and `/account` reads it.
- Needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` and `SESSION_SECRET`. Without them the API answers 503 and the UI says verification isn't switched on. `WALLY_DEV_VERIFY_CODE` is a local-only stand-in, ignored in Vercel production.
- Sign-in at `/signin`: Google OAuth (`/api/auth/google/*`) and emailed sign-in links through Resend (`/api/auth/email/*`). Tokens are typed (`session`, `email-link`) so one can't be used as another. Email links work once.
- `/account` is the settings-style profile: contact, name, sign-in methods, delivery apps, reservations, data privacy. Food services come from `src/lib/connectors.ts` and all show "Coming soon"; none may get a working Connect button until a sanctioned integration exists (rule 8). Use letter tiles, not third-party logos.
- Needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`. `WALLY_DEV_EMAIL_LINKS=1` shows the link on screen locally.
- Motion classes are in `globals.css`. Anything that transforms Wally must also be listed in the `mix-blend-mode: darken` rule, or a box appears around him.
- Tailwind runs through PostCSS (`postcss.config.mjs`), and the Turbopack build cache is off, after a cached Vercel build shipped stale styles.

## Accounts and the database

- Accounts live in Supabase, used as plain Postgres. Wally keeps its own sign-in; Supabase Auth is not used. Needs `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (`SUPABASE_SERVICE_ROLE_KEY` also works).
- The server reaches the database only through the SQL functions in `supabase/migrations` (`wally_sign_in`, `wally_account`, `wally_set_name`, `wally_set_address`, `wally_delete_account`, `wally_use_link`, and the `wally_chat_*` and `wally_messages` functions), called over the project's REST endpoint by `src/lib/server/db.ts`. `src/lib/server/accounts.ts` and `src/lib/server/conversation.ts` are the only callers. The secret key must never reach the browser.
- Tables have row level security on with no policies, and the functions are granted to `service_role` only, so the publishable key can do nothing. Keep that for every new table and function, and add a test for it.
- Schema changes are new files in `supabase/migrations`, applied by hand in the Supabase SQL editor. Never edit a migration that has been applied.
- The session cookie holds only the account id. A sign-in is plain by default: it returns the account that owns the email or phone and ignores whoever was signed in before. Only the account page's Add/Change/Connect links (`?link=1`) attach an email, phone or Google to the signed-in account, and that can fold another account into it. When tables start referencing accounts, `wally_sign_in` has to move those rows in the fold.
- Without the two variables the app falls back to keeping the profile in the cookie (one browser). A cookie from that mode is turned into an account by `/api/session/upgrade`.
- If the database doesn't answer, sign-in and saves fail with a plain message and change nothing.

## Ask Wally and the agent

- `/ask` is the signed-in chat (`src/components/AskWally.tsx`). Signed-in pages share `SignedInHeader`, with the Ask Wally and Account tabs.
- The agent is Claude, called from `src/lib/server/agent.ts`. `reply(thread, guest, channel, onText)` knows nothing about HTTP or the page: the texting agent must call the same function so both channels get the same Wally. The system prompt lives there and encodes the rules above. Wally has no connectors yet, so the prompt forbids claiming to order or book; relax that only as real connectors arrive. The prompt also holds his voice to short messages (under 45 words unless asked for a recipe or plan).
- Needs `ANTHROPIC_API_KEY`. `WALLY_MODEL` picks the model (default `claude-sonnet-5-5`). Check `node_modules/@anthropic-ai/sdk` types and https://platform.claude.com/docs before changing API parameters.
- There is one conversation per account, in `public.messages`, whatever the channel (`web` or `text`). That shared thread is what keeps the website and texting in step. The page re-reads it whenever the tab regains focus.
- `/api/chat`: GET the thread, POST a message (the answer streams back as one JSON event per line), DELETE to erase it. A turn is `wally_chat_begin` (stores the message, enforces `WALLY_DAILY_MESSAGES`, returns recent history), then Claude, then `wally_chat_reply`. If Claude fails, the message is taken back out with `wally_chat_undo` and the page hands the words back to resend.
- Options are structured, not prose: Claude calls the `show_choices` tool, the choices are stored as JSON beside the message, shown as cards on the web, and flattened to a numbered list (`asPlainText`) for text threads and for Claude's own history.
- Finding places: with `GOOGLE_MAPS_API_KEY` set, Claude calls `find_places` (run by `src/lib/server/places.ts` against Google's Places API, near the saved address or a named area) and then `show_places` with the ids it picked. `placeChoices` builds the cards from the search itself: name, miles, open now, rating, website and Maps link. Claude supplies only an emoji and one line of why, so it can't invent a place or a link. Cards are sorted open first, then nearest.
- The saved address is set in the bar pinned to the top of `/ask` (`LocationBar`, rendered by `AskWally`, saved through `/api/account/address`). `AskWally`'s sticky offsets assume the bar is 3.5rem tall. The page re-reads the address, and whether Places is on, from `GET /api/chat` on arrival and on focus, so a page left open across a deploy still shows the bar. It is looked up through Places and stored on the account with its coordinates. The address itself is never sent to Claude; the coordinates go only to Google.
- A place card's first link is the restaurant's own site, shown as a highlighted "Their own site" pill. `isOwnSite` (`src/lib/chat.ts`) decides: a listing's website that is really a marketplace, booking or social page is labelled plain "Website". `describePlaces` passes `own_site` to Claude, and the prompt tells him to favor independent places that have one when the fit is otherwise equal.
- Delivery links on a place card (`deliveryLinks`) open a search for the restaurant's name in DoorDash and Uber Eats. They are not the restaurant's page there: neither app offers a sanctioned lookup, and rule 8 rules out scraping one.
- Google's terms for Places data: show the "Google Maps" attribution with the cards (Google asks for its logo where it fits; the page uses the permitted text form, so swap in the official logo asset if one is supplied), and don't cache Places content other than place IDs. Stored messages hold a snapshot of each card. The open/closed badge is shown only for `OPEN_BADGE_MINUTES` after the answer. Before storing more Places data, or keeping it longer, re-read https://developers.google.com/maps/documentation/places/web-service/policies.
- Without `GOOGLE_MAPS_API_KEY`, Wally falls back to Claude's built-in `web_search` tool to find places (up to three searches a message, each billed by Anthropic), and must ask for the person's area first. With Places on, the web search tool is not offered at all, so review and listing sites never appear beside place cards. A link on a web option card is kept only if it is https and on a site the search returned (`readChoices`). Pages he cites are shown under the answer, which Anthropic's terms require when showing search-backed output to people.
- Messages are plain text, no markdown, so the same words work in a text message. Sources ride inside the text as a closing "Sources:" block (`withSources` / `splitSources` in `src/lib/chat.ts`); the page lifts them out and shows them as links.
- Open item: rule 9. People may mention allergies in conversation, and those messages are stored with the rest of the thread. A separately consented store is still to build before Wally remembers dietary needs.

## When a page breaks

- `src/app/error.tsx` and `src/app/global-error.tsx` both render `components/Recover.tsx`. The usual cause is a deploy landing while a page is open: the old page asks for script files the new version no longer has, and the load fails. `Recover` reloads the page once (at most once a minute, tracked in session storage), and only shows its message if that didn't help.
- It also posts the error to `/api/client-error`, which writes it to the server log as `[client]`. Look there first when someone reports a broken page.
- `Recover` uses inline styles because the app-wide error page renders without the site's stylesheet.

## Conventions

- TypeScript strict. Money is integer cents.
- Tickets, confirmations and errors use neutral, exact language. Personality lives elsewhere, and never while money or a problem is on the table.
- Don't use `next/font/google`; the build environment can't reach Google Fonts. Use system fonts or `next/font/local`.
- Vercel installs only the web app's dependencies, not the root's. Anything `apps/web` imports at build time must be in `apps/web/package.json`. Test files are excluded from the web type check for this reason.
- Never commit secrets. Add new env vars to `.env.example`.
