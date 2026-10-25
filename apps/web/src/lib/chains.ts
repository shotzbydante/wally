/**
 * The big quick-service and fast-casual chains, so a listing can be
 * recognised as one: the card then shows the chain's own icon (fetched from
 * its site by SiteIcon; the mark stays the chain's and only names it), and
 * Wally can say whether that chain usually runs a drive-thru. Google's place
 * data has no drive-thru field, so "usually" is the chain's habit, never a
 * promise about one location; the prompt makes Wally say to confirm.
 */
export interface Chain {
  name: string;
  /** The chain's own site, for its icon. */
  domain: string;
  /** How often a location of this chain has a drive-thru. */
  driveThru: "usually" | "sometimes" | "rarely";
  /** What the chain is for, in a word or two, for the search and the card. */
  kind: string;
}

const chain = (name: string, domain: string, driveThru: Chain["driveThru"], kind: string, pattern?: RegExp): Chain & { pattern: RegExp } => ({
  name,
  domain,
  driveThru,
  kind,
  pattern: pattern ?? new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]?").replace(/\s+/g, "\\s*")}\\b`, "i"),
});

export const CHAINS: ReadonlyArray<Chain & { pattern: RegExp }> = [
  chain("McDonald's", "mcdonalds.com", "usually", "burgers", /^\s*mc\s?donald['’]?s\b/i),
  chain("Starbucks", "starbucks.com", "sometimes", "coffee"),
  chain("Chick-fil-A", "chick-fil-a.com", "usually", "chicken", /^\s*chick[\s-]?fil[\s-]?a\b/i),
  chain("Taco Bell", "tacobell.com", "usually", "tacos"),
  chain("KFC", "kfc.com", "usually", "fried chicken", /^\s*(kfc|kentucky fried chicken)\b/i),
  chain("Pizza Hut", "pizzahut.com", "rarely", "pizza"),
  chain("Wendy's", "wendys.com", "usually", "burgers"),
  chain("Burger King", "bk.com", "usually", "burgers"),
  chain("Popeyes", "popeyes.com", "usually", "fried chicken"),
  chain("Dunkin'", "dunkindonuts.com", "usually", "coffee and donuts", /^\s*dunkin/i),
  chain("Subway", "subway.com", "rarely", "sandwiches"),
  chain("Chipotle", "chipotle.com", "sometimes", "burritos and bowls", /^\s*chipotle\b/i),
  chain("Panera Bread", "panerabread.com", "sometimes", "soups, salads and sandwiches", /^\s*panera\b/i),
  chain("Domino's", "dominos.com", "rarely", "pizza", /^\s*domino['’]?s\b/i),
  chain("Panda Express", "pandaexpress.com", "sometimes", "Chinese-American"),
  chain("Sonic Drive-In", "sonicdrivein.com", "usually", "burgers and shakes", /^\s*sonic drive[\s-]?in\b/i),
  chain("Jack in the Box", "jackinthebox.com", "usually", "burgers and tacos"),
  chain("In-N-Out Burger", "in-n-out.com", "usually", "burgers", /^\s*in[\s-]?n[\s-]?out\b/i),
  chain("Shake Shack", "shakeshack.com", "rarely", "burgers and shakes"),
  chain("Sweetgreen", "sweetgreen.com", "rarely", "salads"),
  chain("Raising Cane's", "raisingcanes.com", "usually", "chicken fingers", /^\s*raising cane['’]?s\b/i),
  chain("Dutch Bros", "dutchbros.com", "usually", "coffee", /^\s*dutch bros/i),
  chain("Five Guys", "fiveguys.com", "rarely", "burgers and fries"),
  chain("Wingstop", "wingstop.com", "rarely", "wings"),
  chain("Jersey Mike's", "jerseymikes.com", "rarely", "subs", /^\s*jersey mike['’]?s\b/i),
  chain("Arby's", "arbys.com", "usually", "roast beef sandwiches"),
  chain("Whataburger", "whataburger.com", "usually", "burgers"),
  chain("Culver's", "culvers.com", "usually", "butter burgers and custard"),
  chain("Dairy Queen", "dairyqueen.com", "usually", "burgers and ice cream", /^\s*(dairy queen|dq\b)/i),
  chain("Little Caesars", "littlecaesars.com", "rarely", "pizza"),
  chain("Carl's Jr.", "carlsjr.com", "usually", "burgers", /^\s*carl['’]?s jr/i),
  chain("Del Taco", "deltaco.com", "usually", "tacos and burgers"),
  chain("El Pollo Loco", "elpolloloco.com", "usually", "grilled chicken"),
  chain("The Habit Burger Grill", "habitburger.com", "sometimes", "charburgers", /^\s*(the )?habit\b/i),
  chain("Wienerschnitzel", "wienerschnitzel.com", "usually", "hot dogs"),
  chain("Baskin-Robbins", "baskinrobbins.com", "rarely", "ice cream", /^\s*baskin/i),
  chain("Krispy Kreme", "krispykreme.com", "usually", "donuts"),
  chain("Peet's Coffee", "peets.com", "sometimes", "coffee", /^\s*peet['’]?s\b/i),
  chain("The Coffee Bean & Tea Leaf", "coffeebean.com", "sometimes", "coffee and tea", /^\s*(the )?coffee bean\b/i),
  chain("Yoshinoya", "yoshinoyaamerica.com", "sometimes", "beef bowls"),
  chain("Blaze Pizza", "blazepizza.com", "rarely", "pizza"),
  chain("Jamba", "jamba.com", "sometimes", "smoothies", /^\s*jamba\b/i),
  chain("Tim Hortons", "timhortons.com", "usually", "coffee and donuts"),
  chain("Qdoba", "qdoba.com", "rarely", "burritos"),
  chain("Zaxby's", "zaxbys.com", "usually", "chicken"),
  chain("Bojangles", "bojangles.com", "usually", "chicken and biscuits"),
  chain("Checkers", "checkers.com", "usually", "burgers", /^\s*(checkers|rally['’]?s)\b/i),
  chain("White Castle", "whitecastle.com", "usually", "sliders"),
  chain("Hardee's", "hardees.com", "usually", "burgers"),
  chain("Steak 'n Shake", "steaknshake.com", "usually", "burgers and shakes", /^\s*steak\s*['’]?n['’]?\s*shake\b/i),
];

/** The chain a listing belongs to, by its name, or undefined for an independent. */
export function chainOf(name: string): Chain | undefined {
  const hit = CHAINS.find((c) => c.pattern.test(name));
  return hit && { name: hit.name, domain: hit.domain, driveThru: hit.driveThru, kind: hit.kind };
}

/** Words that mean the person wants the quick-service kind of answer. */
export const FAST_FOOD_WORDS = /\b(fast[\s-]?food|drive[\s-]?thr(u|ough)|quick bite|chain)s?\b/i;
