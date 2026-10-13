/**
 * Food services Wally intends to work with. None can be connected yet:
 * each needs a sanctioned integration first (see docs/product-brief.md).
 */
export interface FoodService {
  name: string;
  blurb: string;
  /** The service's own website, which is where its icon comes from when we hold no vector mark (see SiteIcon). */
  domain: string;
}

export const delivery: FoodService[] = [
  { name: "DoorDash", domain: "doordash.com", blurb: "Restaurant delivery and pickup, using your DoorDash account and saved card" },
  { name: "Uber Eats", domain: "ubereats.com", blurb: "Restaurant delivery and pickup through your Uber account" },
  { name: "Grubhub", domain: "grubhub.com", blurb: "Restaurant delivery and pickup, including Grubhub+ perks" },
  { name: "Postmates", domain: "postmates.com", blurb: "Delivery from restaurants and local shops" },
  { name: "Caviar", domain: "trycaviar.com", blurb: "Delivery from independent and higher-end restaurants" },
  { name: "Seamless", domain: "seamless.com", blurb: "Restaurant delivery and pickup, mainly in New York" },
  { name: "Instacart", domain: "instacart.com", blurb: "Groceries and prepared food from local stores" },
];

export const reservations: FoodService[] = [
  { name: "OpenTable", domain: "opentable.com", blurb: "Search and book tables under your own name" },
  { name: "Resy", domain: "resy.com", blurb: "Book tables and set Notify alerts for hard-to-get spots" },
  { name: "Tock", domain: "exploretock.com", blurb: "Prepaid reservations, tasting menus and events" },
];
