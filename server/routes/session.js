// HTTP routes for decision sessions. Mounted in index.js at /api/sessions:
//
//   POST /api/sessions                     host creates a session
//   GET  /api/sessions/:id                 load a session (the /s/:id page calls this)
//   POST /api/sessions/:id/join            join with a display name
//   GET  /api/sessions/:id/photo/:option   a ballot option's photo
//
// "Session" here means one decision ("Friday dinner"), not a login session.
// Everything after joining (preferences, votes, stage changes) happens over
// Socket.IO instead, in sockets.js.

import { Router } from "express";
import { randomInt } from "node:crypto";
import { UserError } from "../errors.js";
import { createSession, getSession, joinSession } from "../flow.js";
import { getGuestId, getOrCreateGuestId } from "../guest.js";
import { getPhotoUrl, usingDemoPlaces } from "../places.js";
import { sessions, toPublicSession } from "../store.js";

const router = Router();

// Characters for short ids like "k7Qp2". Leaves out 0/O and 1/l/I so the code
// is easy to read and type if someone has to copy it by hand.
const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_LENGTH = 5; // 55^5 ≈ 500 million possible ids

function makeSessionId() {
  let id;
  do {
    id = "";
    for (let i = 0; i < ID_LENGTH; i++) {
      // randomInt comes from node:crypto, so ids are hard to guess.
      // Math.random() is predictable and shouldn't be used for this.
      id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
    }
  } while (sessions.has(id)); // try again in the very unlikely case it's taken
  return id;
}

// From memory, or loaded from the database after a restart.
async function findSession(id) {
  const session = await getSession(id);
  if (!session) throw new UserError("Session not found.", 404);
  return session;
}

// ---------------------------------------------------------------------------
// POST /api/sessions
// Body: { title, location: { lat, lng, label? }, deadlineMinutes }
// ---------------------------------------------------------------------------
router.post("/", async (req, res) => {
  // In Express 5, req.body is undefined if no JSON was sent, so fall back to {}.
  const { title, location, deadlineMinutes } = req.body ?? {};

  // Validate everything. Anyone can send requests with curl, not just our form.
  if (typeof title !== "string" || !title.trim()) {
    throw new UserError("Title is required.");
  }
  const { lat, lng, label } = location ?? {};
  if (
    typeof lat !== "number" || lat < -90 || lat > 90 ||
    typeof lng !== "number" || lng < -180 || lng > 180
  ) {
    throw new UserError("Pick a location.");
  }
  const minutes = Number(deadlineMinutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
    throw new UserError("Deadline must be 1 to 60 minutes.");
  }

  // The creator gets a guestId too, and it becomes the hostId. The host still
  // types a name through /join like everyone else.
  const guestId = getOrCreateGuestId(req, res);

  const session = {
    id: makeSessionId(),
    title: title.trim().slice(0, 80),
    location: {
      lat,
      lng,
      label: typeof label === "string" && label.trim() ? label.trim().slice(0, 120) : "Pinned location",
    },
    // Store the moment it ends, not "10 minutes", so every browser counts
    // down to the same moment whenever it opens the page.
    deadline: Date.now() + minutes * 60 * 1000,
    stage: "lobby",
    hostId: guestId,
    participants: {},
    options: [],
    notice: null,
    result: null,
    building: false,
    timer: null,
    createdAt: Date.now(),
  };

  await createSession(session); // saves to the database, keeps it in memory, starts the timer

  // 201 means "created". React uses the id to navigate to /s/<id>.
  res.status(201).json(toPublicSession(session, guestId));
});

// ---------------------------------------------------------------------------
// GET /api/sessions/:id
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  const session = await findSession(req.params.id);
  // No cookie is created here: just looking at a session doesn't make you a
  // guest. Without a cookie, "you" is null and the page shows the name box.
  res.json(toPublicSession(session, getGuestId(req)));
});

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/join   Body: { name }
// ---------------------------------------------------------------------------
router.post("/:id/join", async (req, res) => {
  const session = await findSession(req.params.id);
  const guestId = getOrCreateGuestId(req, res);
  await joinSession(session, guestId, req.body?.name); // saves, then tells everyone's lobby
  res.json(toPublicSession(session, guestId));
});

// ---------------------------------------------------------------------------
// GET /api/sessions/:id/photo/:optionId
// Redirects to the photo for one ballot option. Only options on this
// session's ballot work, so nobody can use our API key to fetch any photo.
// ---------------------------------------------------------------------------
const PHOTO_URL_TTL_MS = 10 * 60 * 1000; // Google's photo URLs expire, so re-fetch after a while

router.get("/:id/photo/:optionId", async (req, res) => {
  const session = await findSession(req.params.id);
  const option = session.options.find((o) => o.id === req.params.optionId);
  if (!option?.photoName || usingDemoPlaces) return res.status(404).end();

  if (!option.photoUrl || option.photoUrlAt < Date.now() - PHOTO_URL_TTL_MS) {
    option.photoUrl = await getPhotoUrl(option.photoName);
    option.photoUrlAt = Date.now();
  }
  if (!option.photoUrl) return res.status(404).end();
  res.redirect(option.photoUrl);
});

export default router;
