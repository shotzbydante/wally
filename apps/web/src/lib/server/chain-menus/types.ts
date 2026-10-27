/** One size of a sized item (fries, drinks, shakes, coffee), with its calories. */
export interface MenuItemSize {
  /** Official size name, e.g. "Small", "Medium", "Large", "Kids", "Mini", "Regular", "6 pc". */
  size: string;
  calories: number;
}

export interface ChainMenuItem {
  /** Official item name as shown on the chain's US menu (trademark symbols dropped). */
  name: string;
  /** One plain sentence, in the chain's own terms, saying what is in it. */
  description: string;
  /**
   * Calories for the standard size. For a sized item this is the size named by
   * `servingSize` (medium where the official site gave it, otherwise the size
   * the official product page carries). Omitted when the official site exposes
   * no figure.
   */
  calories?: number;
  /** Which size `calories` refers to, when the item comes in sizes. */
  servingSize?: string;
  /** Every size the official site gives a figure for, including the standard one. */
  sizes?: MenuItemSize[];
  /** Short diner-facing choices: "available as a Meal", "add bacon", piece counts. */
  options?: string[];
  /** e.g. "signature", "breakfast", "limited time", "new", "kids", "vegetarian", "shareable", "value". */
  tags?: string[];
  /** Only when the official site lists allergens for the item. */
  allergens?: string[];
}

export interface MenuCategory {
  name: string;
  items: ChainMenuItem[];
}

export interface ChainMenu {
  chain: string;
  /** The official menu page the data was taken from. */
  source: string;
  /** Year-month the menu was checked, e.g. "2026-10". */
  asOf: string;
  /** Short facts a diner asks about: hours, meals, deals, limited-time items. */
  notes: string[];
  categories: MenuCategory[];
}
