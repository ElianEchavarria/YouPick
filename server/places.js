// Talks to the Google Places API (New). The API key only ever lives here on
// the server; the browser never sees it.
//
// If there's no real key (missing, or not shaped like a Google key), the app
// runs on demo restaurants from fixtures.js so you can build and test
// everything else without spending API credit.

import { UserError } from "./errors.js";
import { demoGeocode, demoSearch } from "./fixtures.js";

const KEY = process.env.GOOGLE_PLACES_KEY?.trim();

// Google API keys always start with "AIza". Anything else is a placeholder.
export const usingDemoPlaces = !KEY || !KEY.startsWith("AIza");

const BASE = "https://places.googleapis.com/v1";

// Only ask for the fields we use. The field mask decides what Google charges
// for, so requesting everything ("*") costs more and is slower.
const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.shortFormattedAddress",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.types",
  "places.currentOpeningHours.openNow",
  "places.servesVegetarianFood",
  "places.googleMapsUri",
  "places.photos",
].join(",");

// Google sends price as words; we use 0–4 so it compares with the budget cap.
const PRICE_LEVELS = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function callGoogle(path, { method = "GET", body, fieldMask } = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      "X-Goog-Api-Key": KEY,
      ...(fieldMask && { "X-Goog-FieldMask": fieldMask }),
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Show the host what went wrong (e.g. "API key not valid"), since they're
    // the one who can fix it. The key itself is never in this message.
    console.error("Google Places error:", res.status, data.error?.message);
    throw new UserError(`Google Places error: ${data.error?.message ?? res.status}`, 502);
  }
  return data;
}

// Turn Google's result into the shape the rest of the app uses.
function normalize(p) {
  return {
    id: p.id,
    name: p.displayName?.text ?? "Unnamed place",
    address: p.shortFormattedAddress ?? p.formattedAddress ?? "",
    location: { lat: p.location.latitude, lng: p.location.longitude },
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? 0,
    price: PRICE_LEVELS[p.priceLevel] ?? null,
    types: p.types ?? [],
    openNow: p.currentOpeningHours?.openNow ?? null,
    vegetarian: p.servesVegetarianFood ?? null,
    mapsUrl: p.googleMapsUri ?? null,
    photoName: p.photos?.[0]?.name ?? null, // used by the photo route, never sent to the browser
  };
}

/**
 * Nearby Search: up to 20 open-or-unknown restaurants within the radius.
 * @returns {Promise<object[]>} normalized places
 */
export async function searchNearby(origin, radiusMeters) {
  if (usingDemoPlaces) return demoSearch(origin, radiusMeters);

  const data = await callGoogle("places:searchNearby", {
    method: "POST",
    fieldMask: SEARCH_FIELDS,
    body: {
      includedTypes: ["restaurant"],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: origin.lat, longitude: origin.lng },
          radius: Math.min(radiusMeters, 50000), // Google's maximum
        },
      },
    },
  });
  return (data.places ?? []).map(normalize);
}

/**
 * Turn a typed area ("downtown Austin") into a { lat, lng, label }.
 * Uses Places Text Search, so the same API key covers it.
 */
export async function geocodeArea(query) {
  if (usingDemoPlaces) return demoGeocode(query);

  const data = await callGoogle("places:searchText", {
    method: "POST",
    fieldMask: "places.location,places.formattedAddress",
    body: { textQuery: query, pageSize: 1 },
  });
  const top = data.places?.[0];
  if (!top) return null;
  return {
    lat: top.location.latitude,
    lng: top.location.longitude,
    label: top.formattedAddress ?? query,
  };
}

/**
 * Get a short-lived image URL for a place photo. skipHttpRedirect makes
 * Google return the URL as JSON instead of redirecting, and that URL doesn't
 * contain our key, so it's safe to send the browser there.
 */
export async function getPhotoUrl(photoName) {
  const data = await callGoogle(`${photoName}/media?maxWidthPx=640&skipHttpRedirect=true`);
  return data.photoUri ?? null;
}
