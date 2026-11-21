// Shared between the React app and the server, so both agree on the same
// cuisine keys, budgets and distances. React imports it to draw the chips;
// the server imports it to validate preferences and match restaurants.

// Each cuisine says how to recognize it in a Google Places result:
//   types: Google place types (e.g. "pizza_restaurant")
//   words: words to look for in the restaurant's name, for places Google
//          only labels as "restaurant" (e.g. "Saffron Halal Grill")
export const CUISINES = [
  { key: "pizza", label: "Pizza", types: ["pizza_restaurant"], words: ["pizza", "pizzeria"] },
  { key: "tacos", label: "Tacos", types: ["mexican_restaurant"], words: ["taco", "taqueria", "mexican", "burrito"] },
  { key: "sushi", label: "Sushi", types: ["sushi_restaurant"], words: ["sushi"] },
  { key: "burgers", label: "Burgers", types: ["hamburger_restaurant"], words: ["burger"] },
  { key: "halal", label: "Halal", types: ["halal_restaurant"], words: ["halal"] },
  { key: "chinese", label: "Chinese", types: ["chinese_restaurant"], words: ["chinese", "wok", "dumpling"] },
  { key: "indian", label: "Indian", types: ["indian_restaurant"], words: ["indian", "curry", "tandoor", "masala"] },
  { key: "thai", label: "Thai", types: ["thai_restaurant"], words: ["thai"] },
  { key: "italian", label: "Italian", types: ["italian_restaurant"], words: ["italian", "trattoria", "pasta", "osteria"] },
  { key: "ramen", label: "Ramen", types: ["ramen_restaurant"], words: ["ramen", "noodle"] },
  { key: "korean", label: "Korean", types: ["korean_restaurant"], words: ["korean", "seoul"] },
  { key: "vietnamese", label: "Vietnamese", types: ["vietnamese_restaurant"], words: ["pho", "vietnamese", "banh mi"] },
  {
    key: "mediterranean",
    label: "Mediterranean",
    types: ["mediterranean_restaurant", "middle_eastern_restaurant", "greek_restaurant", "lebanese_restaurant", "turkish_restaurant"],
    words: ["mediterranean", "gyro", "shawarma", "falafel", "kebab"],
  },
  { key: "bbq", label: "BBQ", types: ["barbecue_restaurant"], words: ["bbq", "barbecue", "smokehouse"] },
  // Sushi counts as seafood, so a "no seafood" hard no also removes sushi spots.
  { key: "seafood", label: "Seafood", types: ["seafood_restaurant", "sushi_restaurant"], words: ["seafood", "oyster", "crab", "lobster", "fish"] },
  { key: "breakfast", label: "Breakfast", types: ["breakfast_restaurant", "brunch_restaurant"], words: ["breakfast", "brunch", "pancake", "diner"] },
  { key: "sandwiches", label: "Sandwiches", types: ["sandwich_shop"], words: ["sandwich", "deli"] },
];

export const DIETARY = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "halal", label: "Halal" },
];

// Budget levels match Google's price levels: 1 = $ (cheap) … 4 = $$$$ (pricey).
export const BUDGETS = [1, 2, 3, 4];

// Max distance choices, in miles.
export const DISTANCES = [0.5, 1, 3, 5];

export const BALLOT_MIN_RANKED = 3; // everyone must rank at least their top 3

const CUISINE_BY_KEY = new Map(CUISINES.map((c) => [c.key, c]));

// Does this place look like the given cuisine? A place is a normalized object
// with at least { name, types } (see server/places.js for the full shape).
export function placeMatchesCuisine(place, cuisineKey) {
  const cuisine = CUISINE_BY_KEY.get(cuisineKey);
  if (!cuisine) return false;
  const types = place.types ?? [];
  if (cuisine.types.some((t) => types.includes(t))) return true;
  const name = (place.name ?? "").toLowerCase();
  return cuisine.words.some((w) => name.includes(w));
}

// Does this place meet a dietary must-have?
// Google tells us "servesVegetarianFood" for many places. If it's unknown
// (null), we give the place the benefit of the doubt instead of hiding it.
// Halal has no such field, so we need the place to clearly look halal.
export function placeFitsDiet(place, dietKey) {
  if (dietKey === "vegetarian") {
    return place.vegetarian !== false;
  }
  if (dietKey === "halal") {
    return placeMatchesCuisine(place, "halal");
  }
  return true;
}

// A friendly cuisine label for a card ("Tacos", "Sushi"), or "Restaurant".
export function cuisineLabel(place) {
  // Check types first, so "Tora Sushi Bar" (sushi_restaurant) says Sushi
  // rather than matching a word in some other cuisine.
  const types = place.types ?? [];
  const byType = CUISINES.find((c) => c.types.some((t) => types.includes(t)));
  if (byType) return byType.label;
  const byName = CUISINES.find((c) => placeMatchesCuisine(place, c.key));
  return byName ? byName.label : "Restaurant";
}

export function priceLabel(level) {
  return level ? "$".repeat(level) : "";
}

export function isCuisineKey(key) {
  return CUISINE_BY_KEY.has(key);
}

export function isDietKey(key) {
  return DIETARY.some((d) => d.key === key);
}
