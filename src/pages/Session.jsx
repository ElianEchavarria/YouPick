// Everything after the link is shared: join, then one screen per stage.
// The server decides the stage; this page just shows the matching screen.

import { Link, useParams } from "react-router-dom";
import Countdown from "../components/Countdown.jsx";
import HostControls from "../components/HostControls.jsx";
import JoinForm from "../components/JoinForm.jsx";
import Lobby from "../components/Lobby.jsx";
import ParticipantList from "../components/ParticipantList.jsx";
import PreferencesForm from "../components/PreferencesForm.jsx";
import Results from "../components/Results.jsx";
import Voting from "../components/Voting.jsx";
import { useSession } from "../useSession.js";

const STAGES = [
  ["lobby", "Lobby"],
  ["preferences", "Preferences"],
  ["voting", "Voting"],
  ["results", "Results"],
];

// key={id} makes React throw away the old page state and start fresh if you
// go from one session link to another, instead of briefly showing the old one.
export default function SessionPage() {
  const { id } = useParams();
  return <Session key={id} id={id} />;
}

function Session({ id }) {
  const { session, error, receive, clockOffset } = useSession(id);

  if (error) {
    return (
      <main className="page">
        <div className="card center">
          <h1>{error === "Session not found." ? "This link has expired" : "Something went wrong"}</h1>
          <p className="muted">{error}</p>
          <Link className="button" to="/">
            Start a new decision
          </Link>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page">
        <p className="muted center">Loading…</p>
      </main>
    );
  }

  const joined = Boolean(session.you);
  const finished = session.stage === "results";

  return (
    <main className="page">
      <header className="session-header">
        <Link to="/" className="brand">
          YouPick
        </Link>
        <h1>{session.title}</h1>
        <p className="muted">📍 {session.location.label}</p>
        <ol className="stages" aria-label="Progress">
          {STAGES.map(([key, label]) => (
            <li key={key} aria-current={session.stage === key ? "step" : undefined}>
              {label}
            </li>
          ))}
        </ol>
        {!finished && <Countdown deadline={session.deadline} clockOffset={clockOffset} />}
      </header>

      {session.demoPlaces && (
        <p className="banner">Demo mode: these restaurants are made up. Add a Google Places key to use real ones.</p>
      )}
      {session.notice && <p className="notice">{session.notice}</p>}

      {/* People who haven't joined see the name box. Results are public, so
          someone opening the link late can still see where the group is going. */}
      {!joined && !finished ? (
        <JoinForm session={session} onJoined={receive} />
      ) : (
        <StageScreen session={session} />
      )}

      {joined && session.isHost && !finished && <HostControls session={session} />}
      {(joined || finished) && <ParticipantList session={session} />}
    </main>
  );
}

function StageScreen({ session }) {
  if (session.building) {
    return (
      <div className="card center">
        <p className="spinner" aria-hidden="true" />
        <p>Finding places that work for everyone…</p>
      </div>
    );
  }
  switch (session.stage) {
    case "lobby":
      return <Lobby session={session} />;
    case "preferences":
      return <PreferencesForm session={session} />;
    case "voting":
      return <Voting session={session} />;
    case "results":
      return <Results session={session} />;
    default:
      return null;
  }
}
