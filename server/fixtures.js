// Demo restaurants, used when there's no real Google Places key.
// The names are made up. Each one sits a fixed distance from wherever the
// session is, so distance filters and "widened to 3 miles" behave like the
// real thing.

const DEMO_PLACES = [
  // name, types, rating, reviews, price, openNow, vegetarian, miles north, miles east
  ["Casa Verde Taqueria", ["mexican_restaurant"], 4.6, 812, 1, true, true, 0.2, 0.1],
  ["Slice Society", ["pizza_restaurant"], 4.4, 530, 1, true, true, -0.3, 0.2],
  ["Tora Sushi Bar", ["sushi_restaurant", "japanese_restaurant"], 4.7, 390, 3, true, true, 0.4, -0.3],
  ["Golden Lotus Thai", ["thai_restaurant"], 4.5, 260, 2, true, true, -0.6, -0.4],
  ["Patty Shack", ["hamburger_restaurant"], 4.2, 1450, 1, true, false, 0.1, -0.2],
  ["Saffron Halal Grill", ["middle_eastern_restaurant"], 4.6, 340, 1, true, true, 0.7, 0.5],
  ["Nonna's Table", ["italian_restaurant"], 4.3, 610, 3, true, true, -0.2, -0.7],
  ["Bombay Spice House", ["indian_restaurant"], 4.5, 420, 2, true, true, 1.6, 0.8],
  ["Harbor & Pearl Seafood", ["seafood_restaurant"], 4.4, 300, 4, true, false, 1.2, -1.5],
  ["Smoke Ring BBQ", ["barbecue_restaurant"], 4.6, 980, 2, true, false, -2.1, 1.0],
  ["Seoul Garden", ["korean_restaurant"], 4.3, 210, 2, true, true, 2.4, -1.1],
  ["Pho Saigon Corner", ["vietnamese_restaurant"], 4.4, 175, 1, true, true, -0.9, 1.3],
  ["Noodle Lab Ramen", ["ramen_restaurant", "japanese_restaurant"], 4.5, 640, 2, false, true, 0.3, 0.6],
  ["Green Fork Kitchen", ["vegetarian_restaurant"], 4.7, 150, 2, true, true, -1.4, -0.6],
  ["Midnight Diner", ["american_restaurant", "breakfast_restaurant"], 4.0, 720, 1, true, true, 3.1, 2.0],
  ["Le Petit Bistro", ["french_restaurant"], 4.6, 95, 4, true, true, -3.5, -1.8],
  ["Dragon Wok", ["chinese_restaurant"], 4.1, 330, 1, true, true, 0.5, -0.9],
  ["Olive & Thyme", ["mediterranean_restaurant", "greek_restaurant"], 4.5, 280, 2, true, true, 2.8, 1.9],
  ["Brick Oven Co.", ["pizza_restaurant", "italian_restaurant"], 4.6, 1200, 2, true, true, 4.2, -0.5],
  ["Taco Loco Truck", ["mexican_restaurant"], 4.3, 88, 1, true, true, -4.4, 0.9],
];

const MILES_PER_DEGREE_LAT = 69;

export function demoSearch(origin, radiusMeters) {
  const radiusMiles = radiusMeters / 1609.34;
  const milesPerDegreeLng = MILES_PER_DEGREE_LAT * Math.cos((origin.lat * Math.PI) / 180);

  return DEMO_PLACES.map(([name, types, rating, reviews, price, openNow, vegetarian, north, east], i) => {
    const location = {
      lat: origin.lat + north / MILES_PER_DEGREE_LAT,
      lng: origin.lng + east / milesPerDegreeLng,
    };
    return {
      id: `demo-${i + 1}`,
      name,
      address: `${Math.hypot(north, east).toFixed(1)} mi away (demo)`,
      location,
      rating,
      reviews,
      price,
      types: [...types, "restaurant"],
      openNow,
      vegetarian,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`,
      photoName: null,
      _miles: Math.hypot(north, east),
    };
  })
    .filter((p) => p._miles <= radiusMiles)
    .map(({ _miles, ...place }) => place);
}

// Without a key we can't really look up "downtown Austin", so every typed
// area lands at the same demo point. The label makes that obvious.
export function demoGeocode(query) {
  return { lat: 30.2672, lng: -97.7431, label: `${query} (demo location)` };
}
