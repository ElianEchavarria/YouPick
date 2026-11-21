// Ranked-choice count (instant runoff).
//
// In plain terms: count everyone's #1 pick. If nobody has more than half,
// knock out the last-place option and move those votes to each voter's next
// choice that's still in the race. Repeat until something has a majority.
//
// This is a "pure function": it only looks at its inputs and returns a
// result. No Express, no sockets, no database. That's what makes it easy to
// test (see rcv.test.js).

/**
 * @param {string[][]} ballots  Each ballot is option ids in order, best first.
 *                              e.g. [["tacos", "pizza"], ["sushi", "tacos", "thai"]]
 * @param {{id: string, score?: number, rating?: number}[]} options
 *        The ballot options. score and rating are only used to break ties.
 * @returns {{
 *   winnerId: string | null,
 *   totalBallots: number,
 *   decidedBy: "majority" | "no-votes" | "no-options",
 *   rounds: Array<{
 *     tallies: Record<string, number>,   // votes per option still in the race
 *     exhausted: number,                 // ballots with no remaining choices
 *     needed: number,                    // votes needed for a majority
 *     eliminated: string | null,         // option knocked out this round
 *     tiedForLast: string[] | null,      // set when a tie-break was needed
 *     tieBreak: "appearances" | "score" | "rating" | "order" | null,
 *     winner: string | null,             // set on the final round
 *   }>
 * }}
 */
export function countVotes(ballots, options) {
  if (options.length === 0) {
    return { winnerId: null, totalBallots: 0, decidedBy: "no-options", rounds: [] };
  }

  const optionById = new Map(options.map((o) => [o.id, o]));

  // Clean the ballots: drop ids that aren't on the ballot and duplicates, then
  // drop ballots that end up empty. The server already validates ballots, but
  // the count shouldn't break if it's ever given bad data.
  const cleanBallots = ballots
    .map((ballot) => [...new Set(ballot)].filter((id) => optionById.has(id)))
    .filter((ballot) => ballot.length > 0);

  // How many ballots list each option at any rank. This is the first
  // tie-breaker: an option more people ranked at all is more acceptable.
  const appearances = new Map(options.map((o) => [o.id, 0]));
  for (const ballot of cleanBallots) {
    for (const id of ballot) appearances.set(id, appearances.get(id) + 1);
  }

  // Nobody voted: fall back to the option the ballot builder liked best.
  if (cleanBallots.length === 0) {
    const best = [...options].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.rating ?? 0) - (a.rating ?? 0),
    )[0];
    return { winnerId: best.id, totalBallots: 0, decidedBy: "no-votes", rounds: [] };
  }

  const remaining = new Set(options.map((o) => o.id));
  const rounds = [];

  while (true) {
    // 1. Give each ballot to its highest-ranked option still in the race.
    const tallies = Object.fromEntries([...remaining].map((id) => [id, 0]));
    let exhausted = 0;
    for (const ballot of cleanBallots) {
      const top = ballot.find((id) => remaining.has(id));
      if (top) tallies[top] += 1;
      else exhausted += 1; // every option this person ranked is out
    }

    // 2. Majority = more than half of the ballots still counting.
    // Exhausted ballots don't count, the same way a voter who left wouldn't.
    const active = cleanBallots.length - exhausted;
    const needed = Math.floor(active / 2) + 1;

    const leader = [...remaining].find((id) => tallies[id] >= needed);
    if (leader || remaining.size === 1) {
      const winner = leader ?? [...remaining][0];
      rounds.push({ tallies, exhausted, needed, eliminated: null, tiedForLast: null, tieBreak: null, winner });
      return { winnerId: winner, totalBallots: cleanBallots.length, decidedBy: "majority", rounds };
    }

    // 3. No majority: knock out last place (using tie-breaks if needed).
    const fewest = Math.min(...Object.values(tallies));
    const lowest = [...remaining].filter((id) => tallies[id] === fewest);
    const { eliminated, tieBreak } = pickElimination(lowest, appearances, optionById);

    rounds.push({
      tallies,
      exhausted,
      needed,
      eliminated,
      tiedForLast: lowest.length > 1 ? lowest : null,
      tieBreak,
      winner: null,
    });
    remaining.delete(eliminated);
  }
}

// Tie-break for last place, from the spec:
//   1. drop the option on fewer ballots overall
//   2. still tied → drop the one with the lower ballot-builder score
//   3. still tied → drop the one with the lower Google rating
//   4. still tied → drop by list order, so the result is always the same
// Returns which rule decided it, so the results screen can explain it.
function pickElimination(lowest, appearances, optionById) {
  if (lowest.length === 1) return { eliminated: lowest[0], tieBreak: null };

  const rules = [
    ["appearances", (id) => appearances.get(id)],
    ["score", (id) => optionById.get(id).score ?? 0],
    ["rating", (id) => optionById.get(id).rating ?? 0],
  ];

  let tied = lowest;
  for (const [name, valueOf] of rules) {
    const min = Math.min(...tied.map(valueOf));
    tied = tied.filter((id) => valueOf(id) === min);
    if (tied.length === 1) return { eliminated: tied[0], tieBreak: name };
  }

  // Last resort: the option that came later in the ballot list goes.
  const order = [...optionById.keys()];
  tied.sort((a, b) => order.indexOf(b) - order.indexOf(a));
  return { eliminated: tied[0], tieBreak: "order" };
}
