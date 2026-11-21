// The winner, plus a round-by-round breakdown so the result feels fair.

import { useState } from "react";
import OptionCard from "./OptionCard.jsx";
import { copyText } from "../clipboard.js";

const TIE_REASONS = {
  appearances: "it was on fewer people's ballots",
  score: "it matched fewer people's preferences",
  rating: "it has a lower Google rating",
  order: "a final tie-break",
};

export default function Results({ session }) {
  const { result, options } = session;
  const [copied, setCopied] = useState(false);

  const byId = new Map(options.map((o) => [o.id, o]));
  const nameOf = (id) => byId.get(id)?.name ?? "?";
  const winner = byId.get(result?.winnerId);

  if (!winner) {
    return (
      <div className="card center">
        <h2>No result</h2>
        <p className="muted">There weren't any options to vote on.</p>
      </div>
    );
  }

  const mapsUrl =
    winner.mapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${winner.name} ${winner.address}`)}`;

  async function copyResult() {
    const rating = winner.rating != null ? ` (★ ${winner.rating.toFixed(1)})` : "";
    const text = `${session.title}: we're going to ${winner.name}${rating}! 🎉\n${mapsUrl}`;
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <div className="card winner">
        <p className="label">The group picked</p>
        <OptionCard option={winner} sessionId={session.id} large />
        <div className="row">
          <a className="button" href={mapsUrl} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
          <button type="button" className="button secondary" onClick={copyResult}>
            {copied ? "Copied!" : "Copy result to chat"}
          </button>
        </div>
      </div>

      <section className="card">
        <h3>How we got here</h3>
        {result.decidedBy === "no-votes" ? (
          <p className="muted">Nobody voted, so the place that best fit everyone's preferences wins.</p>
        ) : (
          <RoundBreakdown result={result} options={options} nameOf={nameOf} />
        )}
      </section>
    </>
  );
}

function RoundBreakdown({ result, options, nameOf }) {
  const { rounds } = result;

  // Rows in finishing order: the winner first, then whoever lasted longest.
  const eliminatedOrder = rounds.map((r) => r.eliminated).filter(Boolean);
  const rowIds = [result.winnerId, ...eliminatedOrder.reverse()];
  const unranked = options.map((o) => o.id).filter((id) => !rowIds.includes(id));

  return (
    <>
      <div className="table-scroll">
        <table className="rounds">
          <thead>
            <tr>
              <th scope="col">Place</th>
              {rounds.map((_, i) => (
                <th key={i} scope="col">
                  R{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rowIds, ...unranked].map((id) => (
              <tr key={id} className={id === result.winnerId ? "winner-row" : ""}>
                <th scope="row">{nameOf(id)}</th>
                {rounds.map((round, i) => (
                  <td key={i} className={round.eliminated === id ? "out" : ""}>
                    {round.tallies[id] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="round-notes">
        {rounds.map((round, i) => (
          <li key={i}>
            <strong>Round {i + 1}:</strong> {describeRound(round, nameOf)}
          </li>
        ))}
      </ol>
    </>
  );
}

function describeRound(round, nameOf) {
  const counted = Object.values(round.tallies).reduce((sum, n) => sum + n, 0);
  const leftover =
    round.exhausted > 0
      ? ` ${round.exhausted} ${round.exhausted === 1 ? "ballot had" : "ballots had"} no picks left.`
      : "";

  if (round.winner) {
    return `${nameOf(round.winner)} wins with ${round.tallies[round.winner]} of ${counted} votes.${leftover}`;
  }

  let text = `No majority (needed ${round.needed}). `;
  if (round.tiedForLast) {
    const tied = round.tiedForLast.map(nameOf).join(" and ");
    text += `${tied} tied for last; ${nameOf(round.eliminated)} is out because ${TIE_REASONS[round.tieBreak]}.`;
  } else {
    text += `${nameOf(round.eliminated)} had the fewest votes and is out.`;
  }
  return text + leftover;
}
