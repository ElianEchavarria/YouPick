import ShareLink from "./ShareLink.jsx";

export default function Lobby({ session }) {
  return (
    <div className="card">
      <h2>Share the link</h2>
      <p className="muted">Paste it in the group chat. Friends just open it and type a name.</p>
      <ShareLink sessionId={session.id} title={session.title} />
      <p className="muted small">
        {session.isHost
          ? "Start preferences when everyone's in. People can still join after."
          : "Waiting for the host to start…"}
      </p>
    </div>
  );
}
