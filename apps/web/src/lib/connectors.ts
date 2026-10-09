/**
 * Food services Wally intends to work with. None can be connected yet:
 * each needs a sanctioned integration first (see docs/product-brief.md).
 */
export interface FoodService {
  name: string;
  blurb: string;
}

export const delivery: FoodService[] = [
  { name: "DoorDash", blurb: "Restaurant delivery and pickup, using your DoorDash account and saved card" },
  { name: "Uber Eats", blurb: "Restaurant delivery and pickup through your Uber account" },
  { name: "Grubhub", blurb: "Restaurant delivery and pickup, including Grubhub+ perks" },
  { name: "Postmates", blurb: "Delivery from restaurants and local shops" },
  { name: "Caviar", blurb: "Delivery from independent and higher-end restaurants" },
  { name: "Seamless", blurb: "Restaurant delivery and pickup, mainly in New York" },
  { name: "Instacart", blurb: "Groceries and prepared food from local stores" },
];

export const reservations: FoodService[] = [
  { name: "OpenTable", blurb: "Search and book tables under your own name" },
  { name: "Resy", blurb: "Book tables and set Notify alerts for hard-to-get spots" },
  { name: "Tock", blurb: "Prepaid reservations, tasting menus and events" },
];
