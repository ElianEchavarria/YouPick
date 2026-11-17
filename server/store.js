// All sessions live here, in memory, keyed by session id (e.g. "k7Qp2").
//
// A Map is like an object made for lookups: sessions.get(id), sessions.set(id, value),
// sessions.has(id). Both the HTTP routes and (in step 4) the socket handlers import
// this same Map, so they always see the same data.
//
// Because it lives in memory, every session disappears when the server restarts.
// That's fine while building; a database can come later.
//
// Shape of one session:
// {
//   id: "k7Qp2",
//   title: "Friday dinner",
//   location: { lat, lng },
//   deadline: 1731369600000,          // a timestamp (ms), not "10 minutes"
//   stage: "lobby" | "preferences" | "voting" | "results",
//   hostId: "<guestId of the creator>",
//   participants: {
//     "<guestId>": { name: "Sam", prefs: null, ballot: null },
//   },
//   options: [],                      // the ballot, filled in step 6
//   result: null,                     // the ranked-choice result, filled in step 8
//   createdAt: 1731369000000,
// }

export const sessions = new Map();
