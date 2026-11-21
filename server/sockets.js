// Socket.IO event handlers: the live part of the app.
//
// Browser → server events (each one replies through an "ack" callback):
//   session:watch  { sessionId }            start getting updates for a session
//   stage:advance  { sessionId }            host moves to the next stage
//   prefs:submit   { sessionId, prefs }     save my preferences
//   ballot:submit  { sessionId, ranking }   save my ranked vote
//
// Server → browser:
//   session:update  <public session>        sent whenever anything changes

import { UserError } from "./errors.js";
import { advanceStage, getSession, submitBallot, submitPrefs } from "./flow.js";
import { guestIdFromCookieHeader } from "./guest.js";
import { roomFor } from "./realtime.js";
import { toPublicSession } from "./store.js";

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    // Who is this? Read the guest cookie that came with the connection.
    // socket.data is per-connection storage provided by Socket.IO.
    socket.data.guestId = guestIdFromCookieHeader(socket.handshake.headers.cookie);
    const guestId = socket.data.guestId;

    socket.on(
      "session:watch",
      handle((session) => {
        socket.join(roomFor(session.id));
        return { session: toPublicSession(session, guestId) };
      }),
    );

    socket.on("stage:advance", handle((session) => advanceStage(session, guestId)));

    socket.on(
      "prefs:submit",
      handle((session, payload) => submitPrefs(session, guestId, payload.prefs)),
    );

    socket.on(
      "ballot:submit",
      handle((session, payload) => submitBallot(session, guestId, payload.ranking)),
    );
  });
}

// Wraps a handler so every event works the same way: look up the session,
// run the handler, and reply with { ok: true, ...result } or { error }.
// The browser waits for that reply (see send() in src/socket.js).
function handle(handler) {
  return async (payload, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      const session = await getSession(payload?.sessionId);
      if (!session) throw new UserError("Session not found.", 404);
      const result = await handler(session, payload);
      reply({ ok: true, ...result });
    } catch (err) {
      if (err instanceof UserError) {
        reply({ error: err.message });
      } else {
        console.error(err);
        reply({ error: "Something went wrong. Please try again." });
      }
    }
  };
}
