# Wally brand identity 2.1

Canonical from 2026-11-24. The source pack is the owner's Google Drive folder "Wally brand pack" (https://drive.google.com/drive/folders/1weZ9HwGaCKOljmPqMNBB4jcK5JICDAgA). When anything here disagrees with it, the pack wins.

Where it applies today: decks, and every email Wally sends. The web app is not migrated yet: it keeps the tokens in `apps/web/src/app/globals.css` and Google Sans until the owner asks for the move.

## Marks

- Primary mark: the stacked badge (Wally above the "Wally the Waiter" plate). Emails use a 400px copy at `apps/web/public/brand/wally-badge-email.png`, shown at 168px.
- Masters: the hero full-body Wally and the face crop. Four pose roles: taking orders, formal welcome, bistro service, menu recommendation.
- Never recolor, stretch or redraw the character, and never place him on a busy background.

## Tokens

| Token | Hex | Use |
|---|---|---|
| Midnight ink | `#151B2C` | Headlines, dark slides |
| Emerald | `#0E7C57` | Buttons, links, accents |
| Emerald hover | `#0A6B4B` | Hover, link text on white |
| Mint | `#DDF6E9` | Highlight panels |
| Canvas | `#F4F6FA` | Page and email background |
| Slate | `#535C6C` | Body and secondary text |
| Border | `#DCE3E8` | Card borders, rules |
| Gold | `#FFC85C` | Sparing highlights |
| Red | `#D93B37` | Errors only |
| Mascot teal | `#55C6A1` | Belongs to the character; not a UI color |
| Butter | `#FFF3D8` | Warm notes |

Cards: white, 20px radius, 1px border, shadow `0 8px 28px rgba(21,27,44,.06)`. Buttons are pills.

## Type

Inter Display for headlines, Inter for everything else. Where Inter Display isn't available (Google Slides, most mail apps), Inter Bold stands in; emails fall back to the system sans.

## Voice

Hospitality first: warm, brief, plainly helpful. Never imply delivery or reservations are live before they are. Tickets, confirmations, errors and sign-in emails stay neutral and exact (see Conventions in CLAUDE.md).

## Emails

Built in `apps/web/src/lib/server/email.ts` (`signInEmail`): canvas background, the badge, one white card with a midnight headline, slate copy and one emerald pill button, the link written out under it, and a plain-text part that says the same thing. Images load from the public site (`siteOrigin`: `APP_URL` when it is https, else https://www.wallywaiter.com). Check a change by rendering the HTML locally, never by sending a test email.
