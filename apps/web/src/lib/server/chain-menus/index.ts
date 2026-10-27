import { chainOf } from "@/lib/chains";
import { mcdonalds } from "./mcdonalds";
import type { ChainMenu, ChainMenuItem } from "./types";

export type { ChainMenu, ChainMenuItem, MenuCategory } from "./types";

/** The chains Wally keeps a menu for, by the name `chainOf` gives. */
const MENUS: Record<string, ChainMenu> = { [mcdonalds.chain]: mcdonalds };

/** The kept menu for a listing's name, if it is a chain Wally keeps one for. */
export function chainMenuFor(name: string): ChainMenu | undefined {
  const chain = chainOf(name)?.name;
  return chain ? MENUS[chain] : undefined;
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);

/** How well an item answers to a few words: every word found in its name scores high, in its description lower. */
function relevance(item: ChainMenuItem, query: string[]): number {
  const name = item.name.toLowerCase();
  const about = `${item.description} ${(item.tags ?? []).join(" ")}`.toLowerCase();
  let score = 0;
  for (const w of query) {
    if (name.includes(w)) score += 3;
    else if (about.includes(w)) score += 1;
  }
  return score;
}

/**
 * The kept menu as Claude is told it: the notes, then every item in compact
 * form, or, when the person asked about something in particular, the items
 * that answer to it first and the rest as names only.
 */
export function describeChainMenu(menu: ChainMenu, lookingFor?: string): string {
  const query = lookingFor ? words(lookingFor) : [];
  const line = (item: ChainMenuItem) =>
    [
      `${item.name}${item.calories !== undefined ? ` (${item.calories} cal)` : ""}: ${item.description}`,
      item.sizes?.length ? `Sizes: ${item.sizes.map((s) => `${s.size}${s.calories !== undefined ? ` ${s.calories} cal` : ""}`).join(", ")}.` : "",
      item.options?.length ? `${item.options.join("; ")}.` : "",
      item.tags?.includes("limited time") ? "Limited time." : "",
    ]
      .filter(Boolean)
      .join(" ");
  const all = menu.categories.flatMap((c) => c.items.map((item) => ({ category: c.name, item })));
  if (query.length) {
    const scored = all.map((x) => ({ ...x, score: relevance(x.item, query) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    const hits = scored.slice(0, 12);
    const rest = menu.categories.map((c) => `${c.name}: ${c.items.map((i) => i.name).join(", ")}`);
    return JSON.stringify({
      restaurant: menu.chain,
      menu_source: menu.source,
      as_of: menu.asOf,
      notes: menu.notes,
      matches: hits.length ? hits.map((x) => `[${x.category}] ${line(x.item)}`) : "Nothing on the menu answers to that; the full menu is listed under everything_else.",
      everything_else: rest,
    });
  }
  return JSON.stringify({
    restaurant: menu.chain,
    menu_source: menu.source,
    as_of: menu.asOf,
    notes: menu.notes,
    menu: menu.categories.map((c) => ({ category: c.name, items: c.items.map(line) })),
  });
}
