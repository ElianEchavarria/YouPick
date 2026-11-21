// The guest cookie: how the server recognizes people without accounts.
// One random guestId per browser, reused for every session that browser
// joins. Incognito has its own cookies, so it acts like a second person.

import { randomUUID } from "node:crypto";

export const GUEST_COOKIE = "guestId";

const COOKIE_OPTIONS = {
  httpOnly: true, // browser JavaScript can't read it, so a malicious script can't steal it
  sameSite: "lax", // sent when someone taps your link from iMessage/Discord
  secure: process.env.NODE_ENV === "production", // HTTPS-only once deployed; localhost is plain HTTP
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, in milliseconds
};

// For Express routes (cookie-parser has already filled in req.cookies).
export function getGuestId(req) {
  return req.cookies?.[GUEST_COOKIE] ?? null;
}

export function getOrCreateGuestId(req, res) {
  let guestId = getGuestId(req);
  if (!guestId) {
    guestId = randomUUID();
    res.cookie(GUEST_COOKIE, guestId, COOKIE_OPTIONS);
  }
  return guestId;
}

// For Socket.IO, which doesn't use Express middleware. The browser sends the
// same cookie when the socket connects, as a raw header like
// "guestId=abc-123; other=thing", so we pick ours out by hand.
export function guestIdFromCookieHeader(header = "") {
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === GUEST_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}
