/**
 * What Wally can do, as the Discover tab lists it. Each idea is a ready-made
 * first message: tapping one opens Ask Wally with `?start=<id>`, and the page
 * sends `ask` for the person. Only ids from this list are accepted, so a link
 * can never put words of its own in someone's mouth.
 *
 * Keep every line true to what Wally does today. Something he can't do yet
 * goes in `soon` (shown, never tappable), and moves up only when it works.
 */
export interface Idea {
  id: string;
  emoji: string;
  /** Wally's offer, in his voice. */
  title: string;
  /** One plain line on what happens. */
  detail: string;
  /** What the person sends to start, in their own voice. */
  ask: string;
  /** Shown only when ordering through Wally is switched on. */
  needs?: "ordering";
}

export interface IdeaSection {
  title: string;
  ideas: Idea[];
}

export const sections: IdeaSection[] = [
  {
    title: "Find a place",
    ideas: [
      {
        id: "craving",
        emoji: "🍜",
        title: "Tell me what you’re craving. I’ll find every place that makes it.",
        detail: "Open spots first, with walk or drive times and a link to each restaurant’s own site.",
        ask: "I’m craving something. Help me find it nearby.",
      },
      {
        id: "local",
        emoji: "🏡",
        title: "I’ll find the local favorites near you.",
        detail: "Independent places with their own sites, so you can order direct.",
        ask: "Show me great local spots near me",
      },
      {
        id: "landmark",
        emoji: "📍",
        title: "Name a theater, stadium or hotel. I’ll find food a short walk away.",
        detail: "I measure from where you’ll be, and sort the walks from the drives.",
        ask: "Find me food within walking distance of where I’m headed.",
      },
      {
        id: "late",
        emoji: "🌙",
        title: "Late night? I’ll find who’s still open.",
        detail: "Only places open right now, with when each one closes.",
        ask: "What’s still open near me right now?",
      },
      {
        id: "drive-thru",
        emoji: "🚗",
        title: "In a hurry? I’ll find fast food and drive-thrus close by.",
        detail: "The big chains near you, and which ones usually have a drive-thru.",
        ask: "Show me fast food and drive-thru options near me",
      },
    ],
  },
  {
    title: "Order",
    ideas: [
      {
        id: "order",
        emoji: "🛍️",
        title: "Pick a dish. I’ll build your pickup order.",
        detail: "At restaurants set up with me. You check the total and pay on the restaurant’s own page.",
        ask: "What can I order through you near me?",
        needs: "ordering",
      },
      {
        id: "menu",
        emoji: "📖",
        title: "Ask me what’s on any menu.",
        detail: "Name a restaurant and what you’re after. I’ll read its menu for you.",
        ask: "Can you check a restaurant’s menu for me?",
      },
    ],
  },
  {
    title: "Plan a meal out",
    ideas: [
      {
        id: "dinner",
        emoji: "🍽️",
        title: "Can’t decide? I’ll help you pick dinner tonight.",
        detail: "Tell me the mood, the budget or who’s coming. I’ll narrow it to a few.",
        ask: "Help me pick dinner tonight",
      },
      {
        id: "date",
        emoji: "🕯️",
        title: "I’ll plan your date night.",
        detail: "The vibe, the spot, and what to do before or after.",
        ask: "Help me plan a date night",
      },
      {
        id: "group",
        emoji: "🥂",
        title: "Dinner for a group? I’ll find a place that works for everyone.",
        detail: "Room for the party, something for every diet, a price that suits the table.",
        ask: "Help me plan a group dinner",
      },
      {
        id: "table",
        emoji: "🎟️",
        title: "Want the table everyone wants? I’ll tell you how to land it.",
        detail: "When bookings open, how the waitlist works, and the best time to call.",
        ask: "How do I land a hard-to-get table?",
      },
    ],
  },
  {
    title: "In your kitchen",
    ideas: [
      {
        id: "cook",
        emoji: "🧑‍🍳",
        title: "Tell me what’s in your fridge. I’ll tell you what to make.",
        detail: "Quick ideas, a recipe when you want one, and help when something goes wrong.",
        ask: "Help me figure out what to cook tonight with what I have.",
      },
    ],
  },
];

/** On Wally's list, not working yet. Shown so people know what's coming; never tappable. */
export const soon: Pick<Idea, "emoji" | "title" | "detail">[] = [
  { emoji: "📅", title: "I’ll book the table for you.", detail: "In your own name, through the restaurant’s booking service." },
  { emoji: "🛵", title: "I’ll send your order out for delivery.", detail: "From the restaurant’s own site or the delivery app you choose." },
];

const all = sections.flatMap((s) => s.ideas);

/** The idea a `?start=` id names, if it is one. */
export const ideaById = (id: unknown): Idea | undefined => (typeof id === "string" ? all.find((i) => i.id === id) : undefined);

/** The idea a sent message started from, so the conversation can show it as the card that was tapped. */
export const ideaFor = (text: string): Idea | undefined => all.find((i) => i.ask === text.trim());
