/**
 * A menu Wally keeps for a big chain, so questions about it are answered at
 * once and exactly, without reading the chain's site. Facts only, from the
 * chain's own published menu and nutrition information; never prices, which
 * vary by location.
 */
export interface ChainMenu {
  chain: string;
  /** The chain's own menu page, the source of what's here and where to send someone for more. */
  source: string;
  /** Year and month the menu was checked against the source, "2026-10". */
  asOf: string;
  /** Short facts a diner asks about: breakfast hours, what a Meal is, where prices live, the app. */
  notes: string[];
  categories: MenuCategory[];
}

export interface MenuCategory {
  name: string;
  items: ChainMenuItem[];
}

export interface ChainMenuItem {
  name: string;
  /** One plain sentence: what's in it. */
  description: string;
  /** For the standard size, or the regular/medium one when it comes in sizes. */
  calories?: number;
  sizes?: { size: string; calories?: number }[];
  /** "available as a Meal", "add bacon". */
  options?: string[];
  /** "signature", "breakfast", "limited time", "kids", "vegetarian". */
  tags?: string[];
  allergens?: string[];
}
