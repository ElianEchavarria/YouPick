// Tap to rank: the first place you tap is your #1, the next #2, and so on.
// Tap a ranked place again to remove it. Top 3 required, the rest optional.
// (Tapping is easier on a phone than drag and drop, and easier to build.)

import { useState } from "react";
import { BALLOT_MIN_RANKED } from "../../shared/catalog.js";
import { send } from "../socket.js";
import OptionCard from "./OptionCard.jsx";

export default function Voting({ session }) {
  const { options } = session;
  const saved = session.you?.ballot;
  const [ranking, setRanking] = useState(saved ?? []);
  const [editing, setEditing] = useState(!saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const minRanked = Math.min(BALLOT_MIN_RANKED, options.length);

  function tap(id) {
    setRanking((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await send("ballot:submit", { sessionId: session.id, ranking });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!session.you) return null; // viewers who haven't joined can't vote

  if (!editing && saved) {
    const byId = new Map(options.map((o) => [o.id, o]));
    return (
      <div className="card">
        <h2>✓ Vote in</h2>
        <ol className="my-ranking">
          {saved.map((id) => (
            <li key={id}>{byId.get(id)?.name}</li>
          ))}
        </ol>
        <p className="muted small">Results appear when everyone has voted or time runs out.</p>
        <button type="button" className="button secondary" onClick={() => setEditing(true)}>
          Change my vote
        </button>
      </div>
    );
  }

  const left = minRanked - ranking.length;

  return (
    <div className="card">
      <h2>Rank your favorites</h2>
      <p className="muted">
        Tap in order: favorite first. Rank at least {minRanked}; the rest are optional.
      </p>
      <div className="options">
        {options.map((option) => {
          const position = ranking.indexOf(option.id);
          return (
            <OptionCard
              key={option.id}
              option={option}
              sessionId={session.id}
              rank={position === -1 ? null : position + 1}
              onClick={() => tap(option.id)}
            />
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="sticky-action">
        <button type="button" className="button wide" onClick={submit} disabled={saving || left > 0}>
          {saving ? "Sending…" : left > 0 ? `Pick ${left} more` : "Submit my vote"}
        </button>
      </div>
    </div>
  );
}
