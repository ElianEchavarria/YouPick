// One shared Socket.IO connection for the whole app.
//
// io() with no URL connects to the same address as the page, so in
// development it goes through Vite's proxy to Express on port 4000.
//
// autoConnect: false means it only connects when the Session page asks it to,
// after the guest cookie exists. The server reads that cookie when the socket
// connects to learn who you are, so connecting earlier would make you anonymous.

import { io } from "socket.io-client";

const socket = io({ autoConnect: false });

// Send an event and wait for the server's reply. The server answers every
// event with { ok: true, ... } or { error: "message" } (see server/sockets.js),
// so this turns that into a normal promise you can await and try/catch.
export async function send(event, payload) {
  const reply = await socket.timeout(15000).emitWithAck(event, payload);
  if (reply?.error) throw new Error(reply.error);
  return reply;
}

export default socket;
