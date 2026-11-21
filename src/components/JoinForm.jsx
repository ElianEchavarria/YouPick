// Name only, no account. Joining sets the guest cookie, and the server
// replies with the session, now including "you".

import { useState } from "react";
import { api } from "../api.js";

const NAME_KEY = "youpick:name";

// Remember the last name typed, for convenience next time. Storage can be
// blocked (private browsing), so every access is wrapped in try/catch.
function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function JoinForm({ session, onJoined }) {
  const [name, setName] = useState(savedName);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  async function join(e) {
    e.preventDefault();
    setJoining(true);
    setError(null);
    try {
      const updated = await api.joinSession(session.id, name);
      try {
        localStorage.setItem(NAME_KEY, name.trim());
      } catch {
        // not saving the name is fine
      }
      onJoined(updated);
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  }

  const others = session.participants.length;

  return (
    <form className="card" onSubmit={join}>
      <h2>{session.isHost ? "You're the host. What should we call you?" : "Join the decision"}</h2>
      {others > 0 && (
        <p className="muted">
          {session.participants.map((p) => p.name).join(", ")} {others === 1 ? "is" : "are"} already in.
        </p>
      )}
      <label className="field">
        <span>Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sam"
          maxLength={30}
          autoFocus
          autoComplete="nickname"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="button wide" disabled={joining || !name.trim()}>
        {joining ? "Joining…" : "I'm in"}
      </button>
    </form>
  );
}
