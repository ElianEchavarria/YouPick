// Active sessions live here, in memory, keyed by session id (e.g. "k7Qp2").
//
// A Map is like an object made for lookups: sessions.get(id), sessions.set(id, value),
// sessions.has(id). Everything goes through flow.js, which reads from this Map.
//
// Memory is the fast working copy; PostgreSQL (db/repo.js) is the permanent
// copy. After a restart this Map starts empty, and flow.getSession() loads a
// session back from the database the first time someone opens its link.
// Without a DATABASE_URL, this Map is the only copy.
//
// Shape of one session:
// {
//   id: "k7Qp2",
//   title: "Friday dinner",
//   location: { lat, lng, label },
//   deadline: 1731369600000,          // a timestamp (ms), not "10 minutes"
//   stage: "lobby" | "preferences" | "voting" | "results",
//   hostId: "<guestId of the creator>",
//   participants: {
//     "<guestId>": { publicId, name, prefs: null | {...}, ballot: null | [optionIds] },
//   },
//   options: [],                      // the ballot, built when voting starts
//   notice: null,                     // e.g. "Widened to 3 miles to find enough options."
//   result: null,                     // the ranked-choice result
//   building: false,                  // true while the ballot is being built
//   timer: null,                      // the deadline setTimeout (server only)
//   createdAt: 1731369000000,
// }

import { usingDemoPlaces } from "./places.js";

export const sessions = new Map();

// What one browser is allowed to see. Never send the raw session:
// participants is keyed by guestId, and anyone who learned another guest's id
// could put it in their own cookie and vote as them. So each participant gets
// a separate publicId for the screen, and "you" / "isHost" describe the viewer.
export function toPublicSession(session, guestId) {
  const me = guestId ? session.participants[guestId] : undefined;
  const showOptions = session.stage === "voting" || session.stage === "results";

  return {
    id: session.id,
    title: session.title,
    location: session.location,
    deadline: session.deadline,
    serverNow: Date.now(), // lets the browser correct for a wrong clock in its countdown
    stage: session.stage,
    building: session.building,
    notice: session.notice,
    participants: Object.entries(session.participants).map(([id, p]) => ({
      id: p.publicId,
      name: p.name,
      isHost: id === session.hostId,
      ready: Boolean(p.prefs), // submitted preferences
      voted: Boolean(p.ballot),
    })),
    options: showOptions ? session.options.map(toPublicOption) : [],
    result: session.stage === "results" ? session.result : null,
    you: me ? { id: me.publicId, name: me.name, prefs: me.prefs, ballot: me.ballot } : null,
    isHost: Boolean(guestId) && session.hostId === guestId,
    demoPlaces: usingDemoPlaces,
  };
}

function toPublicOption(o) {
  return {
    id: o.id,
    name: o.name,
    address: o.address,
    rating: o.rating,
    reviews: o.reviews,
    price: o.price,
    cuisine: o.cuisine,
    distanceMiles: o.distanceMiles,
    score: o.score,
    matches: o.matches,
    mapsUrl: o.mapsUrl,
    hasPhoto: Boolean(o.photoName),
  };
}

// Once an hour, drop sessions older than a day from memory so it doesn't
// grow forever. They stay in the database, so finished decisions can still
// be opened (they're loaded back on demand).
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export function startCleanup() {
  const interval = setInterval(() => {
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const [id, session] of sessions) {
      if (session.createdAt < cutoff) {
        clearTimeout(session.timer);
        sessions.delete(id);
      }
    }
  }, 60 * 60 * 1000);
  interval.unref(); // don't keep Node running just for this timer
}
