// HTTP routes for decision sessions. Mounted in index.js at /api/sessions, so:
//
//   POST /api/sessions           → host creates a session
//   GET  /api/sessions/:id       → anyone loads a session (the /s/:id page calls this)
//   POST /api/sessions/:id/join  → a guest joins with a display name
//
// "Session" here means one decision ("Friday dinner"), NOT a login session.
// There are no accounts. A guest is recognized by a random id stored in a cookie.

import { Router } from "express";
import { randomInt, randomUUID } from "node:crypto";
import { sessions } from "../store.js";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The guest cookie. One guestId per browser, reused for every session that
// browser joins. Opening a link in incognito gives you a new guestId, which is
// why incognito acts like a second person when you test.
const COOKIE_NAME = "guestId";
const COOKIE_OPTIONS = {
  httpOnly: true, // browser JavaScript can't read it, so a malicious script can't steal it
  sameSite: "lax", // sent when someone taps your link from iMessage/Discord, blocked on cross-site form posts
  secure: process.env.NODE_ENV === "production", // HTTPS-only once deployed; localhost is plain HTTP
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, in milliseconds
};

// Characters for short ids like "k7Qp2". Leaves out 0/O and 1/l/I so the code
// is easy to read and type if someone has to copy it by hand.
const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_LENGTH = 5; // 55^5 ≈ 500 million possible ids

function makeSessionId() {
  let id;
  // Loop in the (very unlikely) case the id is already taken.
  do {
    id = "";
    for (let i = 0; i < ID_LENGTH; i++) {
      // randomInt comes from node:crypto, so ids are hard to guess.
      // Math.random() is predictable and shouldn't be used for this.
      id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
    }
  } while (sessions.has(id));
  return id;
}

// Reads the guest's id from their cookie, or creates one and sets the cookie.
function getOrCreateGuestId(req, res) {
  let guestId = req.cookies[COOKIE_NAME];
  if (!guestId) {
    guestId = randomUUID();
    res.cookie(COOKIE_NAME, guestId, COOKIE_OPTIONS);
  }
  return guestId;
}

// What the browser is allowed to see. Never send the raw session object:
// participants is keyed by guestId, and anyone who learns another guest's id
// could put it in their own cookie and vote as them. So we send names only,
// plus "you" and "isHost" so the page knows who is looking at it.
function toPublicSession(session, guestId) {
  const me = session.participants[guestId];
  return {
    id: session.id,
    title: session.title,
    location: session.location,
    deadline: session.deadline,
    stage: session.stage,
    participants: Object.values(session.participants).map((p) => ({
      name: p.name,
    })),
    you: me ? { name: me.name } : null, // null → show the "type your name" box
    isHost: session.hostId === guestId, // true → show the host's controls
  };
}

// ---------------------------------------------------------------------------
// POST /api/sessions: create a session
// Body: { title: "Friday dinner", location: { lat, lng }, deadlineMinutes: 10 }
// ---------------------------------------------------------------------------
router.post("/", (req, res) => {
  // In Express 5, req.body is undefined if no JSON was sent, so fall back to {}.
  const { title, location, deadlineMinutes } = req.body ?? {};

  // Validate everything from the browser. Anyone can send any request with
  // curl, not just your form, so the server can't trust the input.
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required." });
  }
  if (
    !location ||
    typeof location.lat !== "number" ||
    typeof location.lng !== "number"
  ) {
    // Typing an area name ("downtown Austin") needs geocoding to turn it into
    // lat/lng. Start with "use my location" (navigator.geolocation in React)
    // and add typed areas later.
    return res.status(400).json({ error: "Location needs lat and lng." });
  }
  const minutes = Number(deadlineMinutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
    return res
      .status(400)
      .json({ error: "Deadline must be 1 to 60 minutes." });
  }

  // The creator gets a guestId too, and that id becomes the hostId. The host
  // still types a name through /join like everyone else, so there's only one
  // way of joining to build and test.
  const guestId = getOrCreateGuestId(req, res);

  const session = {
    id: makeSessionId(),
    title: title.trim().slice(0, 80), // cap the length so nobody sends a novel
    location: { lat: location.lat, lng: location.lng },
    // Store the moment it ends, not "10 minutes". Every client can then count
    // down to the same moment, whenever they open the page.
    deadline: Date.now() + minutes * 60 * 1000,
    stage: "lobby",
    hostId: guestId,
    participants: {},
    options: [],
    result: null,
    createdAt: Date.now(),
  };

  sessions.set(session.id, session);

  // 201 means "created". React uses the id to navigate to /s/<id>.
  res.status(201).json(toPublicSession(session, guestId));
});

// ---------------------------------------------------------------------------
// GET /api/sessions/:id: load a session
// ---------------------------------------------------------------------------
router.get("/:id", (req, res) => {
  // :id in the path becomes req.params.id, e.g. /api/sessions/k7Qp2 → "k7Qp2"
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }

  // Don't create a cookie here. Just looking at a session shouldn't make you
  // a guest. If there's no cookie, guestId is undefined and "you" is null.
  res.json(toPublicSession(session, req.cookies[COOKIE_NAME]));
});

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/join: join with a display name
// Body: { name: "Sam" }
// ---------------------------------------------------------------------------
router.post("/:id/join", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }

  const name =
    typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 30) : "";
  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }

  const guestId = getOrCreateGuestId(req, res);

  if (session.participants[guestId]) {
    // Already joined (e.g. they reopened the link): just update the name.
    // This also keeps the same person from being added twice.
    session.participants[guestId].name = name;
  } else {
    session.participants[guestId] = { name, prefs: null, ballot: null };
  }

  // Step 4: also broadcast the new participant list over Socket.IO here, so
  // everyone else's lobby updates without refreshing.
  // Step 10: decide what happens if someone joins during voting or after results.

  res.json(toPublicSession(session, guestId));
});

export default router;
