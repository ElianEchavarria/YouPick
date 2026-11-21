// The host's page: title, location, deadline → create → go to /s/<id>.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

const DEADLINES = [5, 10, 15, 30];

export default function Home() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [deadlineMinutes, setDeadlineMinutes] = useState(10);
  const [location, setLocation] = useState(null); // { lat, lng, label }
  const [area, setArea] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Not named "useMyLocation": React treats functions starting with "use" as hooks.
  function shareLocation() {
    if (!navigator.geolocation) {
      setLocationError("Your browser can't share location. Type an area instead.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Near you" });
        setLocating(false);
      },
      (err) => {
        // code 1 = the person said no. Other codes = timeout / unavailable.
        // Note: browsers only allow location on https or localhost, so this
        // fails if you open the dev server from your phone by IP address.
        setLocationError(
          err.code === 1
            ? "Location permission was denied. Type an area instead."
            : "Couldn't get your location. Type an area instead.",
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }

  async function findArea(e) {
    e.preventDefault();
    if (!area.trim()) return;
    setLocating(true);
    setLocationError(null);
    try {
      setLocation(await api.geocode(area));
    } catch (err) {
      setLocationError(err.message);
    } finally {
      setLocating(false);
    }
  }

  async function create(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const session = await api.createSession({ title, location, deadlineMinutes });
      navigate(`/s/${session.id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="brand">YouPick</p>
        <h1>Stop the "I don't care, you pick."</h1>
        <p className="muted">
          Paste one link in the group chat, get a fair answer in two minutes. No accounts needed.
        </p>
      </header>

      <div className="card">
        <label className="field">
          <span>What are you deciding?</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Friday dinner"
            maxLength={80}
            autoFocus
          />
        </label>

        <div className="field">
          <span>Where?</span>
          {location ? (
            <div className="row">
              <p className="location-chosen">📍 {location.label}</p>
              <button type="button" className="link-button" onClick={() => setLocation(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="button secondary" onClick={shareLocation} disabled={locating}>
                {locating ? "Finding you…" : "📍 Use my location"}
              </button>
              {/* A separate form, so pressing Enter here searches instead of creating. */}
              <form className="row" onSubmit={findArea}>
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="or type an area, e.g. downtown Austin"
                  aria-label="Area"
                />
                <button type="submit" className="button secondary" disabled={locating || !area.trim()}>
                  Find
                </button>
              </form>
            </>
          )}
          {locationError && <p className="error">{locationError}</p>}
        </div>

        <form onSubmit={create}>
          <div className="field">
            <span>Decide within</span>
            <div className="segmented">
              {DEADLINES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={deadlineMinutes === m}
                  onClick={() => setDeadlineMinutes(m)}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>

          {error && <p className="error">{error}</p>}
          <button className="button wide" disabled={creating || !title.trim() || !location}>
            {creating ? "Creating…" : "Create & get the link"}
          </button>
        </form>
      </div>
    </main>
  );
}
