// Ballot builder: decides which restaurants make the list.
//
//   1. Merge everyone's preferences into one set of group rules.
//   2. Search nearby, using the smallest max distance anyone chose.
//   3. Filter out anything closed, over the lowest budget, or matching
//      anyone's hard no or failing a dietary must-have.
//   4. Score the survivors and keep the top few.
//   5. If fewer than 3 survive, widen the distance first, then the budget,
//      and say so on screen.
//
// Everything except buildBallot is a pure function. buildBallot takes the
// search function as an argument ("dependency injection"), so the tests can
// pass in a fake search instead of calling Google.

import {
  DISTANCES,
  cuisineLabel,
  placeFitsDiet,
  placeMatchesCuisine,
} from "../shared/catalog.js";

export const MIN_OPTIONS = 3; // fewer than this → relax the filters
export const MAX_OPTIONS = 6; // the spec allows 5–8; 6 keeps ranking quick on a phone

// Used when nobody submitted preferences (e.g. the timer ran out first).
const DEFAULT_MILES = 1;
const DEFAULT_PRICE = 4;

const METERS_PER_MILE = 1609.34;

/**
 * Combine everyone's preferences into the rules the group has to satisfy.
 * @param {Array<{cuisines: string[], hardNos: string[], budget: number,
 *                distance: number, dietary: string[]}>} allPrefs
 */
export function mergePreferences(allPrefs) {
  const prefs = allPrefs.filter(Boolean);
  return {
    // Kept per person, because scoring gives +3 for each PERSON who matches.
    cuisinePicks: prefs.map((p) => p.cuisines),
    // One person's hard no or dietary need applies to the whole group.
    hardNos: [...new Set(prefs.flatMap((p) => p.hardNos))],
    dietary: [...new Set(prefs.flatMap((p) => p.dietary))],
    // The strictest limit wins, so nobody gets dragged somewhere too far or too pricey.
    maxMiles: prefs.length ? Math.min(...prefs.map((p) => p.distance)) : DEFAULT_MILES,
    maxPrice: prefs.length ? Math.min(...prefs.map((p) => p.budget)) : DEFAULT_PRICE,
  };
}

// Straight-line distance between two { lat, lng } points, in miles
// (the "haversine" formula, which accounts for the Earth being round).
export function distanceMiles(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Keep only places that work for everyone.
 * Unknown data (no price level, no opening hours) is allowed through:
 * hiding every place Google is unsure about would leave too few options.
 */
export function filterPlaces(places, group, { maxMiles, maxPrice }, origin) {
  return places.filter((place) => {
    if (place.openNow === false) return false;
    if (place.price != null && place.price > maxPrice) return false;
    if (distanceMiles(origin, place.location) > maxMiles) return false;
    if (group.hardNos.some((key) => placeMatchesCuisine(place, key))) return false;
    if (!group.dietary.every((key) => placeFitsDiet(place, key))) return false;
    return true;
  });
}

/**
 * Score from the spec:
 *   +3 for every person whose cuisine picks match it
 *   +1 × its Google rating (0–5)
 *   +1 if it has 200+ reviews
 */
export function scorePlace(place, group) {
  const matches = group.cuisinePicks.filter((picks) =>
    picks.some((key) => placeMatchesCuisine(place, key)),
  ).length;
  const score = 3 * matches + (place.rating ?? 0) + (place.reviews >= 200 ? 1 : 0);
  return { score: Math.round(score * 10) / 10, matches };
}

/**
 * Build the ballot.
 * @param {object}   args
 * @param {{lat: number, lng: number}} args.origin  The session location.
 * @param {object[]} args.allPrefs                  Each participant's prefs.
 * @param {(origin, radiusMeters) => Promise<object[]>} args.search
 * @returns {Promise<{options: object[], notice: string|null}>}
 */
export async function buildBallot({ origin, allPrefs, search }) {
  const group = mergePreferences(allPrefs);
  let maxMiles = group.maxMiles;
  let maxPrice = group.maxPrice;

  // Search results by radius, so relaxing the budget doesn't search again.
  const searched = new Map();
  async function placesWithin(miles) {
    if (!searched.has(miles)) {
      searched.set(miles, await search(origin, Math.round(miles * METERS_PER_MILE)));
    }
    return searched.get(miles);
  }
  const survivors = async () =>
    filterPlaces(await placesWithin(maxMiles), group, { maxMiles, maxPrice }, origin);

  let found = await survivors();

  // Relax distance first: try each bigger distance step until there are enough.
  for (const miles of DISTANCES.filter((d) => d > maxMiles)) {
    if (found.length >= MIN_OPTIONS) break;
    maxMiles = miles;
    found = await survivors();
  }
  // Then relax the budget, one $ at a time.
  while (found.length < MIN_OPTIONS && maxPrice < 4) {
    maxPrice += 1;
    found = await survivors();
  }

  const notices = [];
  if (maxMiles > group.maxMiles) {
    notices.push(`Widened to ${maxMiles} ${maxMiles === 1 ? "mile" : "miles"} to find enough options.`);
  }
  if (maxPrice > group.maxPrice) notices.push(`Raised the budget to ${"$".repeat(maxPrice)} to find enough options.`);

  const options = found
    .map((place) => ({
      ...place,
      ...scorePlace(place, group),
      cuisine: cuisineLabel(place),
      distanceMiles: Math.round(distanceMiles(origin, place.location) * 10) / 10,
    }))
    // Highest score first; ties go to the better rating, then more reviews.
    .sort((a, b) => b.score - a.score || (b.rating ?? 0) - (a.rating ?? 0) || b.reviews - a.reviews)
    .slice(0, MAX_OPTIONS);

  return { options, notice: notices.join(" ") || null };
}
