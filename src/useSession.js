// Loads a session and keeps it live.
//
//   1. Fetch it once over HTTP, so the page can show something right away.
//   2. Once you've joined, connect the socket and "watch" the session. From
//      then on the server pushes every change as a "session:update".
//
// Returns the latest session, an error message (e.g. "Session not found."),
// a function to replace the session (used after joining), and how far this
// device's clock is from the server's (for the countdown).

import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import socket from "./socket.js";

export function useSession(id) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [clockOffset, setClockOffset] = useState(0);

  // useCallback keeps this the same function between renders, so the effects
  // below don't re-run (and re-subscribe) on every render.
  const receive = useCallback(
    (next) => {
      if (next.id !== id) return; // ignore an update for some other session
      setSession(next);
      setClockOffset(next.serverNow - Date.now());
    },
    [id],
  );

  // 1. Initial load over HTTP.
  useEffect(() => {
    let cancelled = false; // if you navigate away before it loads, don't update
    api
      .getSession(id)
      .then((s) => !cancelled && receive(s))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, receive]);

  // 2. Live updates, once joined.
  const joined = Boolean(session?.you);
  useEffect(() => {
    if (!joined) return;

    // Rooms are forgotten when a socket reconnects (wifi drop, laptop sleep),
    // so watch again on every "connect", not just the first one.
    function watch() {
      socket.emit("session:watch", { sessionId: id }, (reply) => {
        if (reply?.session) receive(reply.session);
      });
    }

    socket.on("connect", watch);
    socket.on("session:update", receive);
    if (socket.connected) watch();
    else socket.connect();

    // Cleanup runs when you leave the page. Without socket.off, every visit
    // would add another listener and each update would be handled twice.
    return () => {
      socket.off("connect", watch);
      socket.off("session:update", receive);
      socket.disconnect();
    };
  }, [id, joined, receive]);

  return { session, error, receive, clockOffset };
}
