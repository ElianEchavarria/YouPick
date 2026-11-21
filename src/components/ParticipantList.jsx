// Who's here, and (depending on the stage) who's ready or has voted.

export default function ParticipantList({ session }) {
  const { participants, stage, you } = session;
  if (participants.length === 0) return null;

  const done = (p) => (stage === "preferences" ? p.ready : stage === "voting" ? p.voted : false);
  const doneCount = participants.filter(done).length;

  return (
    <section className="card">
      <h3>
        {stage === "preferences"
          ? `${doneCount} of ${participants.length} ready`
          : stage === "voting"
            ? `${doneCount} of ${participants.length} have voted`
            : `${participants.length} ${participants.length === 1 ? "person" : "people"}`}
      </h3>
      <ul className="people">
        {participants.map((p) => (
          <li key={p.id} className={done(p) ? "done" : ""}>
            {done(p) && <span aria-label="done">✓ </span>}
            {p.name}
            {p.id === you?.id && <span className="muted"> (you)</span>}
            {p.isHost && <span className="tag">host</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
