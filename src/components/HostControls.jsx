// The host's "next stage" button. Only the host sees it, and the server
// checks again that the person asking really is the host.

import { useState } from "react";
import { send } from "../socket.js";

const LABELS = {
  lobby: "Start preferences →",
  preferences: "Build the ballot →",
  voting: "End voting now",
};

export default function HostControls({ session }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const total = session.participants.length;
  const ready = session.participants.filter((p) => p.ready).length;
  const voted = session.participants.filter((p) => p.voted).length;

  const status = {
    lobby: `${total} joined`,
    preferences: `${ready} of ${total} ready`,
    voting: `${voted} of ${total} voted`,
  }[session.stage];

  async function advance() {
    setBusy(true);
    setError(null);
    try {
      await send("stage:advance", { sessionId: session.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card host-controls">
      <div className="row spread">
        <div>
          <p className="label">Host controls</p>
          <p className="muted small">{status}</p>
        </div>
        <button type="button" className="button" onClick={advance} disabled={busy || session.building}>
          {busy ? "Working…" : LABELS[session.stage]}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
