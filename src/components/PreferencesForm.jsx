// About 20 seconds of tapping: cuisines, hard no's, budget, distance, diet.
// After saving, it shows a summary with an Edit button until the host
// builds the ballot.

import { useState } from "react";
import { BUDGETS, CUISINES, DIETARY, DISTANCES, priceLabel } from "../../shared/catalog.js";
import { send } from "../socket.js";

const DEFAULT_PREFS = { cuisines: [], hardNos: [], budget: 2, distance: 1, dietary: [] };

// Add the key if it's missing, remove it if it's there.
const toggle = (list, key) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

const labelOf = (key) => CUISINES.find((c) => c.key === key)?.label ?? key;

export default function PreferencesForm({ session }) {
  const saved = session.you.prefs;
  const [prefs, setPrefs] = useState(saved ?? DEFAULT_PREFS);
  const [editing, setEditing] = useState(!saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // A cuisine can't be both a pick and a hard no, so choosing one side
  // removes it from the other.
  function toggleCuisine(key) {
    setPrefs((p) => ({ ...p, cuisines: toggle(p.cuisines, key), hardNos: p.hardNos.filter((k) => k !== key) }));
  }
  function toggleHardNo(key) {
    setPrefs((p) => ({ ...p, hardNos: toggle(p.hardNos, key), cuisines: p.cuisines.filter((k) => k !== key) }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await send("prefs:submit", { sessionId: session.id, prefs });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!editing && saved) {
    return (
      <div className="card">
        <h2>✓ You're set</h2>
        <dl className="summary">
          <dt>In the mood for</dt>
          <dd>{saved.cuisines.map(labelOf).join(", ") || "Anything"}</dd>
          <dt>Hard no's</dt>
          <dd>{saved.hardNos.map(labelOf).join(", ") || "None"}</dd>
          <dt>Budget</dt>
          <dd>Up to {priceLabel(saved.budget)}</dd>
          <dt>Distance</dt>
          <dd>Within {saved.distance} mi</dd>
          {saved.dietary.length > 0 && (
            <>
              <dt>Must have</dt>
              <dd>{saved.dietary.map((k) => DIETARY.find((d) => d.key === k)?.label).join(", ")}</dd>
            </>
          )}
        </dl>
        <p className="muted small">Waiting for the host to build the ballot…</p>
        <button type="button" className="button secondary" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={save}>
      <h2>What works for you?</h2>

      <fieldset>
        <legend>In the mood for</legend>
        <div className="chips">
          {CUISINES.map((c) => (
            <button
              key={c.key}
              type="button"
              className="chip"
              aria-pressed={prefs.cuisines.includes(c.key)}
              onClick={() => toggleCuisine(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Hard no's tonight</legend>
        <div className="chips">
          {CUISINES.map((c) => (
            <button
              key={c.key}
              type="button"
              className="chip no"
              aria-pressed={prefs.hardNos.includes(c.key)}
              onClick={() => toggleHardNo(c.key)}
            >
              {prefs.hardNos.includes(c.key) ? "✕ " : ""}
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Max budget</legend>
        <div className="segmented">
          {BUDGETS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={prefs.budget === b}
              onClick={() => setPrefs((p) => ({ ...p, budget: b }))}
            >
              {priceLabel(b)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Max distance</legend>
        <div className="segmented">
          {DISTANCES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={prefs.distance === d}
              onClick={() => setPrefs((p) => ({ ...p, distance: d }))}
            >
              {d} mi
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Must have</legend>
        <div className="chips">
          {DIETARY.map((d) => (
            <button
              key={d.key}
              type="button"
              className="chip"
              aria-pressed={prefs.dietary.includes(d.key)}
              onClick={() => setPrefs((p) => ({ ...p, dietary: toggle(p.dietary, d.key) }))}
            >
              {d.label}
            </button>
          ))}
        </div>
      </fieldset>

      {error && <p className="error">{error}</p>}
      <button className="button wide" disabled={saving}>
        {saving ? "Saving…" : saved ? "Save changes" : "Done"}
      </button>
    </form>
  );
}
