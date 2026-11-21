import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBallot, filterPlaces, mergePreferences, scorePlace } from "./ballot.js";

const origin = { lat: 30.0, lng: -97.0 };
const MILE_LAT = 1 / 69; // about one mile north, in degrees of latitude

// A fake restaurant `miles` north of the origin.
function place(id, { miles = 0.2, types = ["restaurant"], name = id, ...rest } = {}) {
  return {
    id,
    name,
    types,
    location: { lat: origin.lat + miles * MILE_LAT, lng: origin.lng },
    rating: 4.0,
    reviews: 50,
    price: 1,
    openNow: true,
    vegetarian: null,
    ...rest,
  };
}

const prefs = (overrides = {}) => ({
  cuisines: [],
  hardNos: [],
  budget: 4,
  distance: 5,
  dietary: [],
  ...overrides,
});

// A fake search: returns the given places that fall inside the radius,
// and records each radius it was called with.
function fakeSearch(places) {
  const calls = [];
  const search = async (_origin, radiusMeters) => {
    calls.push(radiusMeters);
    return places.filter((p) => (p.location.lat - origin.lat) / MILE_LAT <= radiusMeters / 1609.34);
  };
  return { search, calls };
}

test("mergePreferences uses the strictest budget and distance", () => {
  const group = mergePreferences([
    prefs({ budget: 3, distance: 5, hardNos: ["seafood"] }),
    prefs({ budget: 2, distance: 1, hardNos: ["indian"], dietary: ["vegetarian"] }),
    null, // someone who never submitted
  ]);
  assert.equal(group.maxPrice, 2);
  assert.equal(group.maxMiles, 1);
  assert.deepEqual(group.hardNos, ["seafood", "indian"]);
  assert.deepEqual(group.dietary, ["vegetarian"]);
  assert.equal(group.cuisinePicks.length, 2);
});

test("filter removes closed, too pricey, too far, hard no's and dietary misses", () => {
  const group = mergePreferences([prefs({ hardNos: ["seafood"], dietary: ["vegetarian"] })]);
  const places = [
    place("ok"),
    place("closed", { openNow: false }),
    place("pricey", { price: 4 }),
    place("far", { miles: 2 }),
    place("seafood", { types: ["seafood_restaurant"] }),
    place("sushi", { types: ["sushi_restaurant"] }), // sushi counts as seafood
    place("meaty", { vegetarian: false }),
    place("unknown-price", { price: null }), // unknown data is allowed through
  ];
  const kept = filterPlaces(places, group, { maxMiles: 1, maxPrice: 2 }, origin).map((p) => p.id);
  assert.deepEqual(kept, ["ok", "unknown-price"]);
});

test("score: +3 per matching person, + rating, +1 for 200+ reviews", () => {
  const group = mergePreferences([
    prefs({ cuisines: ["pizza"] }),
    prefs({ cuisines: ["pizza", "tacos"] }),
    prefs({ cuisines: ["sushi"] }),
  ]);
  const pizza = place("p", { types: ["pizza_restaurant"], rating: 4.5, reviews: 300 });
  assert.deepEqual(scorePlace(pizza, group), { score: 3 * 2 + 4.5 + 1, matches: 2 });

  // Matching by name works for places Google only calls "restaurant".
  const tacos = place("t", { name: "Casa Taqueria", rating: 4.0 });
  assert.equal(scorePlace(tacos, group).matches, 1);
});

test("buildBallot ranks by score and caps the list", async () => {
  const places = Array.from({ length: 10 }, (_, i) => place(`p${i}`, { rating: 3 + i * 0.1 }));
  places.push(place("loved", { types: ["thai_restaurant"], rating: 3.0 }));
  const { search } = fakeSearch(places);

  const { options, notice } = await buildBallot({
    origin,
    allPrefs: [prefs({ cuisines: ["thai"] })],
    search,
  });

  assert.equal(options.length, 6);
  assert.equal(options[0].id, "loved"); // +3 for the cuisine beats a better rating
  assert.equal(notice, null);
  assert.equal(options[0].cuisine, "Thai");
});

test("too few options widens the distance first and says so", async () => {
  const { search, calls } = fakeSearch([
    place("near", { miles: 0.3 }),
    place("mid1", { miles: 2 }),
    place("mid2", { miles: 2.5 }),
    place("far", { miles: 4 }),
  ]);

  const { options, notice } = await buildBallot({
    origin,
    allPrefs: [prefs({ distance: 0.5 })],
    search,
  });

  assert.equal(options.length, 3); // stopped at 3 miles, didn't need 5
  assert.equal(notice, "Widened to 3 miles to find enough options.");
  assert.equal(calls.length, 3); // searched at 0.5, 1 and 3 miles
});

test("then raises the budget if widening isn't enough", async () => {
  const { search } = fakeSearch([
    place("cheap"),
    place("mid", { price: 2 }),
    place("fancy", { price: 3 }),
  ]);

  const { options, notice } = await buildBallot({
    origin,
    allPrefs: [prefs({ budget: 1, distance: 0.5 })],
    search,
  });

  assert.equal(options.length, 3);
  assert.equal(
    notice,
    "Widened to 5 miles to find enough options. Raised the budget to $$$ to find enough options.",
  );
});

test("nobody submitted preferences → sensible defaults", async () => {
  const { search, calls } = fakeSearch([place("a"), place("b"), place("c")]);
  const { options } = await buildBallot({ origin, allPrefs: [], search });
  assert.equal(options.length, 3);
  assert.equal(calls[0], 1609); // searched 1 mile
});
