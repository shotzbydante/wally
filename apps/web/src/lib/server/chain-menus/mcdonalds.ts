import type { ChainMenu } from "./types";

/**
 * McDonald's USA national menu, checked October 2026 against mcdonalds.com.
 *
 * Every item below is listed on https://www.mcdonalds.com/us/en-us/full-menu.html
 * (or, for Spicy McNuggets, on its own mcdonalds.com product page and the
 * corporate Menu Spotter dated 09.01.2026). Calories come from each item's
 * mcdonalds.com/us/en-us/product/... page; where that page shows no figure the
 * field is left out. The site itself says its nutrition data is "correct as of
 * January 2022, unless stated otherwise". Prices are deliberately absent: they
 * vary by restaurant and are shown in the McDonald's app.
 *
 * Trademark symbols are dropped from names. Regional items (Twist Cone, Hot
 * Mustard, McRib and other local or seasonal items) are left out because they
 * are not on the national full-menu listing.
 */
export const mcdonalds: ChainMenu = {
  chain: "McDonald's",
  source: "https://www.mcdonalds.com/us/en-us/full-menu.html",
  asOf: "2026-10",
  notes: [
    "Breakfast is served from opening until 10:30 AM at most restaurants, 11:00 AM at some (mcdonalds.com/us/en-us/faq/breakfast.html). Hours are set by each franchisee and vary; check the app for a given restaurant. All-day breakfast ended in 2020.",
    "Hash Browns are only sold while the breakfast menu is on. Lunch items start when breakfast ends.",
    "Prices vary by restaurant and are not shown on mcdonalds.com; the McDonald's app shows the price at the restaurant you pick. McDelivery prices may be higher and delivery fees may apply.",
    "A Meal (Extra Value Meal) is the sandwich or entree plus World Famous Fries and a fountain drink. The official calorie figures assume medium fries and a medium drink; fries and drink can be ordered small, medium or large. Breakfast meals come with Hash Browns and a small Premium Roast Coffee instead.",
    "A Happy Meal is a Hamburger, 4 piece or 6 piece Chicken McNuggets with Kids Fries, Apple Slices, a toy and a choice of 1% Low Fat Milk, Reduced Sugar Low Fat Chocolate Milk, DASANI Water or Honest Kids Appley Ever After organic juice drink.",
    "McValue (in the app and at the counter): an Under $3 Menu (breakfast: Sausage Biscuit, Sausage McMuffin, Sausage Burrito, Hash Browns, medium Premium Roast Coffee; lunch and dinner: McDouble, McChicken, 4 piece McNuggets, small Fries, medium soft drink), $4 Breakfast Meal Deals (Sausage McMuffin or Sausage Biscuit with Hash Browns and a small coffee) and Meal Deals from $5 (McDouble or McChicken with 4 piece McNuggets, small Fries and a small Coca-Cola; $6 in some areas). The Meal Deals are marked limited time. Prices and participation vary.",
    "The McDonald's app has daily deals (for example a weekly free medium fries with a $1 purchase through 10/4/26) and MyMcDonald's Rewards: 100 points per $1 spent on eligible app orders, redeemable for free food. Opt in to Rewards in the app to earn points.",
    "Limited time: the Monopoly Game at McDonald's runs 10/6/26 to 11/1/26 (game pieces with qualifying purchases while supplies last; the Chance Card game ends 11/8/26, prize claims by 11/22/26). Only large drinks carry game pieces. The Limited Time Monopoly Menu lists the qualifying items (Big Mac, Quarter Pounder with Cheese, 10 piece McNuggets, McCrispy Strips, Fries, most breakfast sandwiches, Hash Browns, large drinks and McCafe drinks).",
    "Limited time: Spicy Chicken McNuggets returned 9/1/26 at participating restaurants (6, 10 and 20 piece), for a limited time.",
    "Limited time: the Disney Villains Boo Buckets Happy Meal started 10/20/26 (Jafar, Ursula, Scar, Cruella, Maleficent buckets), while supplies last.",
    "New in 2026: McCafe specialty drinks (Red Bull Dragonberry Energizer, Sprite Berry Blast, Dirty Dr Pepper, Vanilla Swirl with Coca-Cola, Strawberry Watermelon, Mango Pineapple and Blackberry Passion Fruit Refreshers, Orange Dream). They are labelled New, not limited time, on the menu.",
    "Coming 11/3/26 (limited time): holiday drinks - Frosted Cranberry Splash with Sprite, Red Bull Frosted Cranberry Energizer and Cookie Butter Frappe, Latte and Iced Coffee.",
    "Drive-thru and late-night hours vary by restaurant; many are open 24 hours but the menu may be reduced overnight. Check the restaurant in the app.",
    "Sauces for McNuggets and McCrispy Strips add 30-110 calories each: Creamy Chili Dip, Tangy Barbeque, Spicy Buffalo, Creamy Ranch, Honey Mustard, Sweet 'N Sour, Honey.",
    "McDonald's lists ingredient information for the nine major allergens on its nutrition calculator but warns that shared kitchen areas mean any item may contact other allergens.",
  ],
  categories: [
    {
      // Source: https://www.mcdonalds.com/us/en-us/full-menu/burgers.html and each
      // item's page under https://www.mcdonalds.com/us/en-us/product/ (big-mac,
      // quarter-pounder-with-cheese, double-quarter-pounder-with-cheese,
      // deluxe-quarter-pounder-with-cheese, quarter-pounder-bacon, mcdouble,
      // daily-double, cheeseburger, double-cheeseburger, hamburger); meal from
      // https://www.mcdonalds.com/us/en-us/meal/big-mac-meal.html
      name: "Burgers",
      items: [
        {
          name: "Big Mac",
          description:
            "Two 100% beef patties, Big Mac sauce, shredded lettuce, chopped onion, pickles and a slice of American cheese on a three-part sesame seed bun.",
          calories: 580,
          options: ["available as a Meal", "with or without onions", "with or without pickles"],
          tags: ["signature"],
        },
        {
          name: "Quarter Pounder with Cheese",
          description:
            "A quarter pound of fresh beef seasoned with salt and pepper, two slices of American cheese, slivered onions and pickles on a sesame seed bun.",
          calories: 520,
          options: ["available as a Meal", "with or without onions", "with or without pickles"],
          tags: ["signature"],
        },
        {
          name: "Double Quarter Pounder with Cheese",
          description:
            "Two quarter-pound fresh beef patties seasoned with salt and pepper, two slices of American cheese, slivered onions and pickles on a sesame seed bun.",
          calories: 740,
          options: ["available as a Meal"],
        },
        {
          name: "Quarter Pounder with Cheese Deluxe",
          description:
            "A quarter-pound fresh beef patty with shredded lettuce, Roma tomato slices, two slices of American cheese, mayo, slivered onions and pickles on a sesame seed bun.",
          calories: 630,
          options: ["available as a Meal"],
        },
        {
          name: "Bacon Quarter Pounder with Cheese",
          description:
            "A quarter-pound fresh beef patty with smoked bacon, two slices of American cheese, slivered onions and pickles on a sesame seed bun.",
          calories: 630,
          options: ["available as a Meal"],
        },
        {
          name: "McDouble",
          description:
            "Two 100% beef patties seasoned with salt and pepper, a slice of American cheese, pickles, chopped onions, ketchup and mustard.",
          calories: 390,
          options: ["on the Under $3 Menu", "McDouble Meal Deal (limited time)"],
          tags: ["value"],
        },
        {
          name: "Daily Double",
          description:
            "Two 100% beef patties with American cheese, shredded lettuce, slivered onions, mayo and two tomato slices.",
          calories: 490,
        },
        {
          name: "Cheeseburger",
          description:
            "A 100% beef patty seasoned with salt and pepper, a slice of American cheese, a pickle, chopped onions, ketchup and mustard on a regular bun.",
          calories: 300,
          options: ["available as a Meal"],
        },
        {
          name: "Double Cheeseburger",
          description:
            "Two 100% beef patties seasoned with salt and pepper, two slices of American cheese, pickles, chopped onions, ketchup and mustard.",
          calories: 440,
        },
        {
          name: "Hamburger",
          description:
            "A 100% beef patty seasoned with salt and pepper, a pickle, chopped onions, ketchup and mustard on a regular bun.",
          calories: 250,
          options: ["in the Hamburger Happy Meal"],
        },
        {
          name: "Big Mac Meal",
          description:
            "A Big Mac with medium World Famous Fries and a medium fountain drink.",
          calories: 1170,
          servingSize: "Medium (with medium Coca-Cola)",
          options: ["small, medium or large fries and drink", "any fountain drink"],
        },
      ],
    },
    {
      // Source: https://www.mcdonalds.com/us/en-us/full-menu/chicken-and-fish-sandwiches.html
      // and product pages mccrispy-chicken-sandwich, deluxe-mccrispy-chicken-sandwich,
      // spicy-mccrispy-chicken-sandwich, spicy-deluxe-mccrispy-chicken-sandwich,
      // filet-o-fish, mcchicken
      name: "Chicken & Fish Sandwiches",
      items: [
        {
          name: "McCrispy",
          description:
            "A southern-style fried chicken fillet with crinkle-cut pickles on a toasted, buttered potato roll.",
          calories: 470,
          options: ["available as a Meal"],
          tags: ["signature"],
        },
        {
          name: "Deluxe McCrispy",
          description:
            "A southern-style fried chicken fillet with shredded lettuce, Roma tomatoes and mayo on a toasted, buttered potato roll.",
          calories: 530,
          options: ["available as a Meal"],
        },
        {
          name: "Spicy McCrispy",
          description:
            "A southern-style fried chicken fillet with Spicy Pepper Sauce and crinkle-cut pickles on a toasted, buttered potato roll.",
          calories: 530,
          options: ["available as a Meal"],
        },
        {
          name: "Spicy Deluxe McCrispy",
          description:
            "A southern-style fried chicken fillet with Spicy Pepper Sauce, shredded lettuce and Roma tomatoes on a toasted, buttered potato roll.",
          calories: 530,
          options: ["available as a Meal"],
        },
        {
          name: "Filet-O-Fish",
          description:
            "A fish fillet made with wild-caught Alaskan Pollock, tartar sauce and a half slice of American cheese on a steamed bun.",
          calories: 380,
          options: ["available as a Meal"],
          tags: ["signature"],
        },
        {
          name: "McChicken",
          description:
            "A crispy chicken patty with shredded lettuce and mayonnaise on a toasted bun.",
          calories: 390,
          options: ["on the Under $3 Menu", "McChicken Meal Deal (limited time)"],
          tags: ["value"],
        },
      ],
    },
    {
      // Source: https://www.mcdonalds.com/us/en-us/full-menu.html (McNuggets & McCrispy
      // Strips and Snack Wrap sections) and product pages chicken-mcnuggets-4-piece,
      // -6-piece, -10-piece, -20-piece, -40-piece, spicy-chicken-mcnuggets-6-piece,
      // -10-piece, -20-piece, mccrispy-strips-3-piece, ranch-snack-wrap, spicy-snack-wrap;
      // meals from https://www.mcdonalds.com/us/en-us/meal/chicken-mcnuggets-10-piece-meal.html
      // and https://www.mcdonalds.com/us/en-us/meal/3-piece-mccrispy-strips-meal.html
      name: "McNuggets & Meals",
      items: [
        {
          name: "Chicken McNuggets",
          description:
            "Tender, juicy nuggets made with all white meat chicken and no artificial colors, flavors or preservatives, served with your choice of dipping sauce.",
          calories: 410,
          servingSize: "10 pc",
          sizes: [
            { size: "4 pc", calories: 170 },
            { size: "6 pc", calories: 250 },
            { size: "10 pc", calories: 410 },
            { size: "20 pc", calories: 830 },
            { size: "40 pc", calories: 1650 },
          ],
          options: [
            "4, 6, 10, 20 or 40 piece",
            "10 piece available as a Meal",
            "4 piece on the Under $3 Menu",
            "dipping sauces: Tangy Barbeque, Spicy Buffalo, Creamy Ranch, Honey Mustard, Sweet 'N Sour, Honey, Creamy Chili",
          ],
          tags: ["signature"],
        },
        {
          name: "Spicy Chicken McNuggets",
          description:
            "Chicken McNuggets in a crispy, spicy tempura-style breading seasoned with cayenne and aged chili pepper.",
          calories: 490,
          servingSize: "10 pc",
          sizes: [
            { size: "6 pc", calories: 290 },
            { size: "10 pc", calories: 490 },
            { size: "20 pc", calories: 980 },
          ],
          options: ["6, 10 or 20 piece", "at participating restaurants"],
          tags: ["limited time"],
        },
        {
          name: "McCrispy Strips",
          description:
            "Crispy, juicy chicken strips made with all white meat chicken and black pepper flavor, now crispier, made for dipping in Creamy Chili McCrispy Strip Dip.",
          calories: 400,
          servingSize: "3 pc",
          sizes: [{ size: "3 pc", calories: 400 }],
          options: ["3 or 4 piece", "available as a Meal", "any dipping sauce"],
        },
        {
          name: "McCrispy Strip Ranch Snack Wrap",
          description:
            "A McCrispy Strip with shredded cheese, shredded lettuce and creamy ranch sauce in a soft tortilla.",
          calories: 400,
          options: ["available as a Meal", "Ranch & Spicy Snack Wrap Meal (one of each)"],
        },
        {
          name: "McCrispy Strip Spicy Snack Wrap",
          description:
            "A McCrispy Strip with shredded cheese, shredded lettuce and Spicy Pepper Sauce in a soft tortilla.",
          calories: 390,
          options: ["available as a Meal", "Ranch & Spicy Snack Wrap Meal (one of each)"],
        },
        {
          name: "10 Piece Chicken McNuggets Meal",
          description:
            "Ten Chicken McNuggets with medium World Famous Fries and a medium fountain drink; sauces add 30-110 calories each.",
          calories: 1000,
          servingSize: "Medium (with medium Coca-Cola)",
          options: ["small, medium or large fries and drink", "any fountain drink"],
        },
        {
          name: "McCrispy Strips Meal",
          description:
            "Three McCrispy Strips with medium World Famous Fries and a medium fountain drink; sauces add 30-110 calories each.",
          calories: 970,
          servingSize: "3 pc, medium (with medium Sprite)",
          options: ["3 or 4 piece", "small, medium or large fries and drink"],
        },
        {
          name: "Snack Wrap Meal",
          description:
            "A Ranch or Spicy McCrispy Strip Snack Wrap, or one of each, with World Famous Fries and a fountain drink.",
          options: ["Ranch", "Spicy", "Ranch & Spicy (one of each)"],
        },
      ],
    },
    {
      // Source: https://www.mcdonalds.com/us/en-us/full-menu/fries-sides.html and
      // https://www.mcdonalds.com/us/en-us/full-menu/sauces-and-condiments.html; product
      // pages small-french-fries, medium-french-fries, large-french-fries, kids-fries,
      // apple-slices, creamy-chili-sauce, tangy-barbeque-sauce, spicy-buffalo-sauce,
      // creamy-ranch-sauce, honey-mustard-sauce, sweet-n-sour-sauce, honey,
      // ketchup-packet, mayonnaise-packet, mustard-package
      name: "Fries & Sides",
      items: [
        {
          name: "World Famous Fries",
          description:
            "Golden fries made from premium potatoes such as Russet Burbank and Shepody, crispy outside and fluffy inside, with 0g trans fat per labeled serving.",
          calories: 320,
          servingSize: "Medium",
          sizes: [
            { size: "Kids", calories: 110 },
            { size: "Small", calories: 230 },
            { size: "Medium", calories: 320 },
            { size: "Large", calories: 480 },
          ],
          options: ["small on the Under $3 Menu", "part of every Meal"],
          tags: ["signature", "vegetarian"],
        },
        {
          name: "Apple Slices",
          description: "Crisp, juicy slices of real apple, as a snack or a side.",
          calories: 15,
          options: ["included in every Happy Meal"],
          tags: ["kids", "vegetarian"],
        },
        {
          name: "Creamy Chili McCrispy Strip Dip",
          description:
            "A tangy, savory dip with mild chili heat and a toasted sesame finish, made for McCrispy Strips and fries.",
          calories: 110,
        },
        {
          name: "Tangy Barbeque Sauce",
          description:
            "A sweet, tangy, smoky dipping sauce with a tomato paste base, vinegar, spices and a hint of hickory smoke.",
          calories: 45,
        },
        {
          name: "Spicy Buffalo Sauce",
          description: "A spicy vinegar-and-butter dipping sauce with building heat.",
          calories: 30,
        },
        {
          name: "Creamy Ranch Sauce",
          description: "A tangy, creamy dipping sauce with onion and garlic notes.",
          calories: 110,
        },
        {
          name: "Honey Mustard Sauce",
          description:
            "A dipping sauce blending Dijon mustard with the sweetness of honey and a touch of spice.",
          calories: 60,
        },
        {
          name: "Sweet 'N Sour Sauce",
          description:
            "A tangy dipping sauce with apricot and peach flavors, savory spices and a mild lingering warmth.",
          calories: 50,
        },
        {
          name: "Honey",
          description: "Pure Grade A honey, used as a dip for Chicken McNuggets.",
          calories: 50,
        },
        {
          name: "Ketchup Packet",
          description: "Classic tomato ketchup made from ripe tomatoes.",
          calories: 10,
        },
        {
          name: "Mayonnaise Packet",
          description: "Creamy mayonnaise for a sandwich or for dipping fries.",
          calories: 90,
        },
        {
          name: "Mustard Packet",
          description: "Yellow mustard for a sandwich or for dipping.",
          calories: 0,
        },
      ],
    },
    {
      // Source: https://www.mcdonalds.com/us/en-us/full-menu/breakfast.html and product
      // pages egg-mcmuffin, sausage-mcmuffin, sausage-mcmuffin-with-egg,
      // bacon-egg-cheese-biscuit, sausage-biscuit, sausage-biscuit-with-egg,
      // egg-cheese-biscuit, bacon-egg-cheese-mcgriddles, sausage-mcgriddles,
      // sausage-egg-cheese-mcgriddles, bacon-egg-cheese-bagel, sausage-egg-and-cheese-bagel,
      // steak-egg-cheese-bagel, bagel-plain, egg-and-cheese-bagel, big-breakfast,
      // big-breakfast-with-hotcakes, hotcakes, hotcakes-and-sausage, sausage-burrito,
      // hash-browns, fruit-maple-oatmeal; meal from
      // https://www.mcdonalds.com/us/en-us/meal/egg-mcmuffin-meal.html
      name: "Breakfast",
      items: [
        {
          name: "Egg McMuffin",
          description:
            "A freshly cracked egg, lean Canadian bacon and a slice of American cheese on a toasted English muffin with real butter.",
          calories: 310,
          options: ["available as a Meal"],
          tags: ["breakfast", "signature"],
        },
        {
          name: "Sausage McMuffin",
          description:
            "A hot sausage patty and a slice of melted American cheese on a toasted English muffin.",
          calories: 400,
          options: ["on the Under $3 Menu", "$4 Sausage McMuffin Meal Deal (limited time)"],
          tags: ["breakfast", "value"],
        },
        {
          name: "Sausage McMuffin with Egg",
          description:
            "A hot sausage patty, a freshly cracked egg and a slice of melted American cheese on a toasted English muffin.",
          calories: 480,
          options: ["available as a Meal"],
          tags: ["breakfast"],
        },
        {
          name: "Bacon, Egg & Cheese Biscuit",
          description:
            "Smoked bacon, a folded egg and a slice of American cheese on a warm buttermilk biscuit brushed with butter.",
          calories: 460,
          options: ["available as a Meal"],
          tags: ["breakfast"],
        },
        {
          name: "Sausage Biscuit",
          description: "A hot sausage patty on a warm buttermilk biscuit brushed with real butter.",
          calories: 460,
          options: ["on the Under $3 Menu", "$4 Sausage Biscuit Meal Deal (limited time)"],
          tags: ["breakfast", "value"],
        },
        {
          name: "Sausage Biscuit with Egg",
          description:
            "A hot sausage patty and a folded egg on a warm buttermilk biscuit brushed with butter.",
          calories: 530,
          options: ["available as a Meal"],
          tags: ["breakfast"],
        },
        {
          name: "Egg & Cheese Biscuit",
          description:
            "A folded egg and a slice of melted American cheese on a warm buttermilk biscuit brushed with butter.",
          calories: 390,
          tags: ["breakfast", "vegetarian"],
        },
        {
          name: "Bacon, Egg & Cheese McGriddles",
          description:
            "Smoked bacon, a folded egg and a slice of American cheese between two soft, warm griddle cakes with the taste of maple.",
          calories: 430,
          options: ["available as a Meal"],
          tags: ["breakfast"],
        },
        {
          name: "Sausage McGriddles",
          description:
            "A savory sausage patty between two soft, warm griddle cakes with the taste of maple.",
          calories: 430,
          options: ["available as a Meal"],
          tags: ["breakfast"],
        },
        {
          name: "Sausage, Egg & Cheese McGriddles",
          description:
            "A sausage patty, a folded egg and a slice of American cheese between two soft, warm griddle cakes with the taste of maple.",
          calories: 550,
          options: ["available as a Meal"],
          tags: ["breakfast"],
        },
        {
          name: "Bacon, Egg & Cheese Bagel",
          description:
            "Smoked bacon, a folded egg, two slices of American cheese and creamy breakfast sauce on a toasted, buttered bagel.",
          calories: 590,
          options: ["available as a Meal"],
          tags: ["breakfast"],
        },
        {
          name: "Sausage, Egg & Cheese Bagel",
          description:
            "A sausage patty, a folded egg, two slices of American cheese and creamy breakfast sauce on a toasted, buttered bagel.",
          calories: 710,
          tags: ["breakfast"],
        },
        {
          name: "Steak, Egg & Cheese Bagel",
          description:
            "A steak patty, a folded egg, American cheese, grilled onions and breakfast sauce on a toasted, buttered bagel.",
          calories: 680,
          options: ["available as a Meal"],
          tags: ["breakfast"],
        },
        {
          name: "Bagel (plain)",
          description: "A plain toasted bagel.",
          calories: 270,
          tags: ["breakfast", "vegetarian"],
        },
        {
          name: "Egg & Cheese Bagel",
          description:
            "A folded egg, melted American cheese and creamy breakfast sauce on a toasted bagel.",
          calories: 520,
          tags: ["breakfast", "vegetarian"],
        },
        {
          name: "Big Breakfast",
          description:
            "Scrambled eggs, a sausage patty, Hash Browns and a warm buttermilk biscuit.",
          calories: 760,
          tags: ["breakfast"],
        },
        {
          name: "Big Breakfast with Hotcakes",
          description:
            "Scrambled eggs, a sausage patty, Hash Browns, a warm buttermilk biscuit and golden hotcakes with butter and maple-flavored syrup.",
          calories: 1340,
          tags: ["breakfast"],
        },
        {
          name: "Hotcakes",
          description:
            "Three golden-brown hotcakes with real butter and sweet maple-flavored syrup.",
          calories: 580,
          tags: ["breakfast", "vegetarian"],
        },
        {
          name: "Hotcakes and Sausage",
          description:
            "Three golden-brown hotcakes with butter and maple-flavored syrup, with a hot sausage patty on the side.",
          calories: 770,
          tags: ["breakfast"],
        },
        {
          name: "Sausage Burrito",
          description:
            "Scrambled egg, pork sausage, melted cheese, green chiles and onion in a soft tortilla.",
          calories: 310,
          options: ["available as a Meal", "on the Under $3 Menu"],
          tags: ["breakfast", "value"],
        },
        {
          name: "Hash Browns",
          description:
            "A shredded potato patty, crispy outside and fluffy inside, sold while breakfast is served.",
          calories: 140,
          options: ["on the Under $3 Menu", "in every breakfast Meal"],
          tags: ["breakfast", "vegetarian", "value"],
        },
        {
          name: "Fruit & Maple Oatmeal",
          description:
            "Whole-grain oats with a touch of cream and brown sugar, topped with diced apples, cranberries and two kinds of raisins.",
          calories: 320,
          tags: ["breakfast", "vegetarian"],
        },
        {
          name: "Egg McMuffin Meal",
          description: "An Egg McMuffin with Hash Browns and a small Premium Roast Coffee.",
          calories: 455,
          servingSize: "With Hash Browns and small coffee",
          options: ["any drink in place of the coffee"],
          tags: ["breakfast"],
        },
      ],
    },
    {
      // Source: https://www.mcdonalds.com/us/en-us/full-menu/happy-meal.html and
      // https://www.mcdonalds.com/us/en-us/meal/hamburger-happy-meal.html,
      // https://www.mcdonalds.com/us/en-us/meal/4-piece-chicken-mcnuggets-happy-meal.html,
      // https://www.mcdonalds.com/us/en-us/meal/6-piece-chicken-mcnuggets-happy-meal.html
      name: "Happy Meal",
      items: [
        {
          name: "Hamburger Happy Meal",
          description:
            "A Hamburger with Kids Fries, Apple Slices, a kids drink and a Happy Meal toy.",
          calories: 475,
          servingSize: "With Kids Fries, Apple Slices and 1% Low Fat Milk",
          options: [
            "drink: 1% Low Fat Milk, Reduced Sugar Low Fat Chocolate Milk, DASANI Water or Honest Kids Appley Ever After juice drink",
          ],
          tags: ["kids"],
        },
        {
          name: "4 Piece Chicken McNuggets Happy Meal",
          description:
            "Four Chicken McNuggets with Kids Fries, Apple Slices, a kids drink and a Happy Meal toy.",
          calories: 395,
          servingSize: "With Kids Fries, Apple Slices and 1% Low Fat Milk",
          options: [
            "drink: 1% Low Fat Milk, Reduced Sugar Low Fat Chocolate Milk, DASANI Water or Honest Kids Appley Ever After juice drink",
            "dipping sauce",
          ],
          tags: ["kids"],
        },
        {
          name: "6 Piece Chicken McNuggets Happy Meal",
          description:
            "Six Chicken McNuggets with Kids Fries, Apple Slices, a kids drink and a Happy Meal toy.",
          calories: 475,
          servingSize: "With Kids Fries, Apple Slices and 1% Low Fat Milk",
          options: [
            "drink: 1% Low Fat Milk, Reduced Sugar Low Fat Chocolate Milk, DASANI Water or Honest Kids Appley Ever After juice drink",
            "dipping sauce",
          ],
          tags: ["kids"],
        },
      ],
    },
    {
      // Source: https://www.mcdonalds.com/us/en-us/full-menu/mccafe-coffees.html and the
      // product pages coffee-small/-medium/-large, coffee-decaf-medium, iced-coffee-small/
      // -medium/-large, iced-coffee-black-small, iced-coffee-caramel-small,
      // iced-coffee-french-vanilla-small, hot-tea-small, hot-chocolate-small/-medium,
      // espresso-americano-coffee-small, frappe-caramel-small/-medium/-large,
      // frappe-mocha-small/-medium/-large, cappuccino-small/-medium,
      // french-vanilla-cappuccino-small, caramel-cappuccino-small, mocha-latte-small/-medium,
      // iced-mocha-small/-medium, latte-small/-medium, latte-caramel-small,
      // latte-french-vanilla-small, iced-latte-small, iced-caramel-latte-small/-medium,
      // caramel-macchiato-small/-medium, iced-caramel-macchiato-small.
      // Hot drinks come small, medium and large; calories given for the sizes whose
      // pages were checked. Lattes, cappuccinos and macchiatos are made with whole milk.
      name: "McCafé Coffees",
      items: [
        {
          name: "Premium Roast Coffee",
          description:
            "Hot coffee brewed from 100% Arabica beans, served black or with sugar, sweetener or dairy creamer.",
          calories: 10,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 5 },
            { size: "Medium", calories: 10 },
            { size: "Large", calories: 10 },
          ],
          options: ["cream and sugar on the side", "medium on the Under $3 Menu"],
          tags: ["value"],
        },
        {
          name: "Premium Roast Decaf Coffee",
          description:
            "Decaffeinated hot coffee brewed from 100% Arabica beans, served black or with sugar, sweetener or dairy creamer.",
          calories: 10,
          servingSize: "Medium",
          sizes: [{ size: "Medium", calories: 10 }],
          options: ["cream and sugar on the side"],
        },
        {
          name: "Iced Coffee",
          description:
            "Premium roast coffee over ice with cream and your choice of flavor syrup, or black.",
          calories: 190,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 150 },
            { size: "Medium", calories: 190 },
            { size: "Large", calories: 270 },
          ],
          options: ["flavor: regular, caramel, French vanilla or black", "sugar-free French vanilla at some restaurants"],
        },
        {
          name: "Iced Black Coffee",
          description: "Unsweetened 100% Arabica coffee over ice, no cream, no sugar.",
          calories: 10,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 5 },
            { size: "Medium", calories: 10 },
            { size: "Large", calories: 15 },
          ],
        },
        {
          name: "Iced Caramel Coffee",
          description: "Premium roast coffee over ice with cream and buttery caramel syrup.",
          calories: 150,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 150 }],
        },
        {
          name: "Iced French Vanilla Coffee",
          description: "Premium roast coffee over ice with cream and smooth French vanilla syrup.",
          calories: 150,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 150 }],
        },
        {
          name: "Hot Tea",
          description: "A black tea blend of orange pekoe and pekoe cut leaves, served hot.",
          calories: 10,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 10 }],
        },
        {
          name: "Hot Chocolate",
          description:
            "Steamed whole milk and rich chocolate syrup, topped with whipped light cream and chocolate drizzle.",
          calories: 440,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 360 },
            { size: "Medium", calories: 440 },
          ],
          tags: ["kids"],
        },
        {
          name: "Americano",
          description: "Rainforest Alliance Certified espresso with hot water.",
          calories: 0,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 0 }],
        },
        {
          name: "Caramel Frappé",
          description:
            "A blended iced drink of caramel flavor and a hint of coffee, topped with whipped light cream and caramel drizzle.",
          calories: 490,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 420 },
            { size: "Medium", calories: 490 },
            { size: "Large", calories: 650 },
          ],
        },
        {
          name: "Mocha Frappé",
          description:
            "A blended iced drink of rich chocolate and a hint of coffee, topped with whipped light cream and chocolate drizzle.",
          calories: 490,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 430 },
            { size: "Medium", calories: 490 },
            { size: "Large", calories: 660 },
          ],
        },
        {
          name: "Cappuccino",
          description: "Espresso with steamed whole milk and a layer of foam.",
          calories: 160,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 110 },
            { size: "Medium", calories: 160 },
          ],
          options: ["add a flavor: French vanilla or caramel"],
        },
        {
          name: "French Vanilla Cappuccino",
          description: "Espresso with steamed whole milk, foam and French vanilla syrup.",
          calories: 210,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 210 }],
        },
        {
          name: "Caramel Cappuccino",
          description: "Espresso with steamed whole milk, foam and buttery caramel syrup.",
          calories: 210,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 210 }],
        },
        {
          name: "Latte",
          description: "Rainforest Alliance Certified espresso with steamed whole milk.",
          calories: 190,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 140 },
            { size: "Medium", calories: 190 },
          ],
          options: ["add a flavor: caramel or French vanilla", "nonfat milk at some restaurants"],
        },
        {
          name: "Caramel Latte",
          description: "Espresso with steamed whole milk and buttery caramel syrup.",
          calories: 250,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 250 }],
        },
        {
          name: "French Vanilla Latte",
          description: "Espresso with steamed whole milk and French vanilla syrup.",
          calories: 250,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 250 }],
        },
        {
          name: "Mocha Latte",
          description:
            "Espresso with steamed whole milk and chocolate syrup, topped with whipped light cream and chocolate drizzle.",
          calories: 370,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 290 },
            { size: "Medium", calories: 370 },
          ],
        },
        {
          name: "Caramel Macchiato",
          description:
            "Espresso with steamed whole milk and buttery caramel syrup, finished with caramel drizzle.",
          calories: 320,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 260 },
            { size: "Medium", calories: 320 },
          ],
        },
        {
          name: "Iced Latte",
          description: "Rainforest Alliance Certified espresso with whole milk over ice.",
          calories: 80,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 80 }],
          options: ["add a flavor: caramel or French vanilla"],
        },
        {
          name: "Iced Caramel Latte",
          description: "Espresso with whole milk and buttery caramel syrup over ice.",
          calories: 220,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 180 },
            { size: "Medium", calories: 220 },
          ],
        },
        {
          name: "Iced Mocha Latte",
          description:
            "Espresso with whole milk and chocolate syrup over ice, topped with whipped light cream and chocolate drizzle.",
          calories: 320,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 270 },
            { size: "Medium", calories: 320 },
          ],
        },
        {
          name: "Iced Caramel Macchiato",
          description:
            "Dark-roasted espresso, buttery caramel syrup and whole milk over ice, finished with caramel drizzle.",
          calories: 200,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 200 }],
        },
      ],
    },
    {
      // Source: https://www.mcdonalds.com/us/en-us/full-menu/mccafe-coffees.html lists no
      // bakery items, and none appear on the full menu or the Sweets & Treats page as of
      // October 2026 (the McCafé Bakery line of apple fritters, blueberry muffins and
      // cinnamon rolls is no longer on the national menu). Left empty rather than
      // invented; the Chocolate Chip Cookie and Baked Apple Pie are under Desserts.
      name: "McCafé Bakery",
      items: [],
    },
    {
      // Source: https://www.mcdonalds.com/us/en-us/full-menu/sweets-treats.html and
      // product pages mcflurry-with-oreo-cookies, mm-candy-mcflurry, vanilla-cone,
      // chocolate-shake-small/-medium/-large, vanilla-shake-small/-medium/-large,
      // strawberry-shake-small/-medium/-large, hot-fudge-sundae, hot-caramel-sundae,
      // baked-hot-apple-pie, chocolate-chip-cookie
      name: "Desserts & Shakes",
      items: [
        {
          name: "OREO McFlurry",
          description: "Vanilla soft serve swirled with crunchy OREO cookie pieces.",
          calories: 410,
          servingSize: "Regular",
          sizes: [{ size: "Regular", calories: 410 }],
          options: ["Mini or Regular"],
          tags: ["signature"],
        },
        {
          name: "M&M'S McFlurry",
          description: "Vanilla soft serve swirled with crunchy M&M'S candies.",
          calories: 570,
          servingSize: "Regular",
          sizes: [{ size: "Regular", calories: 570 }],
          options: ["Mini or Regular"],
        },
        {
          name: "Vanilla Cone",
          description: "Smooth vanilla soft serve in a crunchy cone.",
          calories: 200,
          tags: ["vegetarian"],
        },
        {
          name: "Chocolate Shake",
          description:
            "Vanilla soft serve blended with chocolate syrup, topped with whipped light cream.",
          calories: 650,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 520 },
            { size: "Medium", calories: 650 },
            { size: "Large", calories: 800 },
          ],
        },
        {
          name: "Vanilla Shake",
          description:
            "Vanilla soft serve blended with vanilla syrup, topped with whipped light cream.",
          calories: 570,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 480 },
            { size: "Medium", calories: 570 },
            { size: "Large", calories: 780 },
          ],
        },
        {
          name: "Strawberry Shake",
          description:
            "Vanilla soft serve blended with strawberry syrup, topped with whipped light cream.",
          calories: 600,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 470 },
            { size: "Medium", calories: 600 },
            { size: "Large", calories: 850 },
          ],
        },
        {
          name: "Hot Fudge Sundae",
          description: "Vanilla soft serve with rich chocolate hot fudge topping.",
          calories: 330,
          options: ["with or without peanuts"],
        },
        {
          name: "Hot Caramel Sundae",
          description: "Vanilla soft serve with warm, buttery caramel topping.",
          options: ["with or without peanuts"],
        },
        {
          name: "Baked Apple Pie",
          description:
            "U.S.-grown apples baked in a lattice crust and sprinkled with sugar.",
          calories: 230,
          tags: ["signature"],
        },
        {
          name: "Chocolate Chip Cookie",
          description: "A warm, soft-baked, chewy cookie packed with chocolate chips.",
          calories: 170,
        },
      ],
    },
    {
      // Source: https://www.mcdonalds.com/us/en-us/full-menu/drinks.html and product pages
      // red-bull-dragonberry-energizer, reduced-sugar-red-bull-dragonberry-energizer,
      // sprite-berry-blast-small, strawberry-watermelon-refresher-small, dirty-dr-pepper-small,
      // vanilla-swirl-with-coke-small, reduced-sugar-vanilla-swirl-with-diet-coke-small,
      // mango-pineapple-refresher-small, blackberry-passionfruit-refresher-small,
      // orange-dream-small, orange-dream-with-fanta-small, coca-cola-small/-medium/-large,
      // diet-coke-small/-medium, coca-cola-zero-sugar-small, sprite-small/-medium,
      // hi-c-orange-lavaburst-small/-medium, dr-pepper-small/-medium, lemonade-small/-medium,
      // sweet-tea-small, iced-tea-small, dasani-water, 1-low-fat-milk-jug,
      // reduced-sugar-low-fat-chocolate-milk-carton, minute-maid-orange-juice-small/
      // -medium-201248/-large, honest-kids-appley-ever-after-6-fl-oz-drink-box,
      // frozen-hawaiian-punch-small, frozen-coke-small, frozen-fanta-blue-raspberry-small,
      // strawberry-banana-smoothie-small/-medium, mango-pineapple-smoothie-small/-medium.
      // Fountain drinks come extra small, small, medium and large; calories are based on
      // standard fill levels plus ice.
      name: "Beverages",
      items: [
        {
          name: "Red Bull Dragonberry Energizer",
          description:
            "Red Bull with blue raspberry flavor and freeze-dried dragon fruit over ice; contains caffeine.",
          calories: 200,
          tags: ["new"],
        },
        {
          name: "Reduced Sugar Red Bull Dragonberry Energizer",
          description:
            "Red Bull Zero with blue raspberry flavor and freeze-dried dragon fruit over ice; contains caffeine.",
          calories: 100,
          tags: ["new"],
        },
        {
          name: "Sprite Berry Blast",
          description: "Sprite with blue raspberry flavor over ice, topped with chilled cold foam.",
          calories: 240,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 240 }],
          options: ["small, medium or large"],
          tags: ["new"],
        },
        {
          name: "Strawberry Watermelon Refresher",
          description:
            "Strawberry and watermelon flavors with tangy lemonade over ice, topped with freeze-dried strawberries; contains caffeine.",
          calories: 160,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 160 }],
          options: ["small, medium or large"],
          tags: ["new"],
        },
        {
          name: "Dirty Dr Pepper",
          description: "Dr Pepper with a vanilla twist over ice, topped with chilled cold foam.",
          calories: 250,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 250 }],
          options: ["small, medium or large"],
          tags: ["new"],
        },
        {
          name: "Vanilla Swirl with Coca-Cola",
          description: "Coca-Cola with vanilla over ice, topped with chilled cold foam.",
          calories: 250,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 250 }],
          options: ["small, medium or large"],
          tags: ["new"],
        },
        {
          name: "Reduced Sugar Vanilla Swirl with Diet Coke",
          description: "Diet Coke with vanilla over ice, topped with chilled cold foam.",
          calories: 190,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 150 },
            { size: "Medium", calories: 190 },
            { size: "Large", calories: 230 },
          ],
          tags: ["new"],
        },
        {
          name: "Mango Pineapple Refresher",
          description:
            "Mango and pineapple flavors with tangy lemonade over ice, with strawberry popping boba; contains caffeine.",
          calories: 180,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 180 }],
          options: ["small, medium or large"],
          tags: ["new"],
        },
        {
          name: "Blackberry Passion Fruit Refresher",
          description:
            "Blackberry and passion fruit flavors with lemonade over ice, topped with freeze-dried dragon fruit; contains caffeine.",
          calories: 170,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 170 }],
          options: ["small, medium or large"],
          tags: ["new"],
        },
        {
          name: "Orange Dream with Hi-C",
          description:
            "Hi-C Orange Lavaburst with vanilla over ice, topped with cold foam; caffeine-free and not carbonated.",
          calories: 350,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 260 },
            { size: "Medium", calories: 350 },
            { size: "Large", calories: 450 },
          ],
          tags: ["new"],
        },
        {
          name: "Orange Dream with Fanta",
          description:
            "Fanta Orange with vanilla over ice, topped with chilled cold foam; caffeine-free and carbonated.",
          calories: 340,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 250 },
            { size: "Medium", calories: 340 },
            { size: "Large", calories: 440 },
          ],
          tags: ["new"],
        },
        {
          name: "Coca-Cola",
          description: "Fountain Coca-Cola over ice.",
          calories: 270,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 200 },
            { size: "Medium", calories: 270 },
            { size: "Large", calories: 380 },
          ],
          options: ["extra small, small, medium or large", "medium on the Under $3 Menu"],
          tags: ["value"],
        },
        {
          name: "Diet Coke",
          description: "Zero-calorie fountain Diet Coke over ice.",
          calories: 0,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 0 },
            { size: "Medium", calories: 0 },
          ],
          options: ["extra small, small, medium or large"],
        },
        {
          name: "Coca-Cola Zero Sugar",
          description: "Zero-sugar fountain Coca-Cola over ice.",
          options: ["extra small, small, medium or large"],
        },
        {
          name: "Sprite",
          description: "Caffeine-free lemon-lime fountain Sprite over ice.",
          calories: 250,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 190 },
            { size: "Medium", calories: 250 },
          ],
          options: ["extra small, small, medium or large"],
        },
        {
          name: "Hi-C Orange Lavaburst",
          description: "Orange-flavored Hi-C fruit drink over ice.",
          calories: 280,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 220 },
            { size: "Medium", calories: 280 },
          ],
          options: ["extra small, small, medium or large"],
        },
        {
          name: "Dr Pepper",
          description: "Fountain Dr Pepper over ice.",
          calories: 250,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 190 },
            { size: "Medium", calories: 250 },
          ],
          options: ["extra small, small, medium or large"],
        },
        {
          name: "Lemonade",
          description: "Chilled lemonade made with real lemon juice, lemon pulp and cane sugar.",
          calories: 190,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 120 },
            { size: "Medium", calories: 190 },
          ],
          options: ["small, medium or large"],
        },
        {
          name: "Sweet Tea",
          description: "Sweetened iced black tea brewed from orange pekoe and pekoe cut leaves.",
          calories: 170,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 170 }],
          options: ["extra small, small, medium or large"],
        },
        {
          name: "Unsweetened Iced Tea",
          description: "Zero-calorie, sugar-free iced black tea brewed from orange pekoe leaves.",
          calories: 0,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 0 }],
          options: ["extra small, small, medium or large"],
        },
        {
          name: "DASANI Water",
          description: "Bottled purified water enhanced with minerals.",
          calories: 0,
          options: ["a Happy Meal drink choice"],
          tags: ["kids"],
        },
        {
          name: "1% Low Fat Milk Carton",
          description: "Low fat white milk in a carton, a good source of calcium and vitamins A and D.",
          calories: 100,
          options: ["a Happy Meal drink choice"],
          tags: ["kids"],
        },
        {
          name: "Reduced Sugar Low Fat Chocolate Milk Carton",
          description:
            "Low fat chocolate milk in a carton with 25% less sugar than leading quick-service restaurants' chocolate milk.",
          calories: 130,
          options: ["a Happy Meal drink choice"],
          tags: ["kids"],
        },
        {
          name: "Minute Maid Premium Orange Juice",
          description: "100% orange juice with vitamin C.",
          calories: 190,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 150 },
            { size: "Medium", calories: 190 },
            { size: "Large", calories: 270 },
          ],
          tags: ["breakfast"],
        },
        {
          name: "Honest Kids Appley Ever After Organic Juice Drink",
          description: "A 6 fl oz organic apple juice drink box with no added sugar.",
          calories: 35,
          options: ["a Happy Meal drink choice"],
          tags: ["kids"],
        },
        {
          name: "Frozen Hawaiian Punch",
          description: "A frozen drink with the Fruit Juicy Red flavor of Hawaiian Punch.",
          calories: 60,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 60 }],
          options: ["small, medium or large"],
        },
        {
          name: "Frozen Coca-Cola Classic",
          description: "A frozen slush with the taste of Coca-Cola Classic.",
          calories: 60,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 60 }],
          options: ["small, medium or large"],
        },
        {
          name: "Frozen Fanta Blue Raspberry",
          description: "A sweet, tangy blue raspberry frozen slush.",
          calories: 60,
          servingSize: "Small",
          sizes: [{ size: "Small", calories: 60 }],
          options: ["small, medium or large", "at participating restaurants"],
        },
        {
          name: "Strawberry Banana Smoothie",
          description:
            "Strawberry and banana fruit purees and juices blended with low fat yogurt and ice.",
          calories: 240,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 190 },
            { size: "Medium", calories: 240 },
          ],
          options: ["small, medium or large"],
        },
        {
          name: "Mango Pineapple Smoothie",
          description:
            "Mango and pineapple fruit purees and juices blended with low fat yogurt and ice.",
          calories: 250,
          servingSize: "Medium",
          sizes: [
            { size: "Small", calories: 200 },
            { size: "Medium", calories: 250 },
          ],
          options: ["small, medium or large"],
        },
      ],
    },
  ],
};
