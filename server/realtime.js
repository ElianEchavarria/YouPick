// Holds the Socket.IO server and sends session updates to everyone watching.
// Kept in its own small file so flow.js and the routes can broadcast without
// importing index.js (which would create a circular import).

import { toPublicSession } from "./store.js";

let io = null;

export function setIo(server) {
  io = server;
}

// Every session has a Socket.IO "room". Joining a room means "send me
// updates about this session"; emitting to the room reaches everyone in it.
export function roomFor(sessionId) {
  return `session:${sessionId}`;
}

// Send the latest state to everyone watching a session. Each person gets
// their own copy, because "you" and "isHost" are different for each viewer.
export async function broadcastSession(session) {
  if (!io) return;
  try {
    const sockets = await io.in(roomFor(session.id)).fetchSockets();
    for (const socket of sockets) {
      socket.emit("session:update", toPublicSession(session, socket.data.guestId));
    }
  } catch (err) {
    console.error("Broadcast failed:", err);
  }
}
