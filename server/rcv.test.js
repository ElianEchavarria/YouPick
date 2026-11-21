// Run with: npm test
// Uses Node's built-in test runner, so there's nothing extra to install.

import { test } from "node:test";
import assert from "node:assert/strict";
import { countVotes } from "./rcv.js";

const opt = (id, score = 0, rating = 0) => ({ id, score, rating });

test("the worked example from the spec: Tacos wins 4–2 in round 3", () => {
  const options = [opt("tacos"), opt("pizza"), opt("sushi"), opt("thai")];
  const ballots = [
    ["tacos", "pizza"],
    ["tacos", "pizza"],
    ["pizza", "sushi"],
    ["pizza", "sushi"],
    ["sushi", "tacos"],
    ["thai", "tacos"], // Thai appears on only 1 ballot, Sushi on 3
  ];

  const result = countVotes(ballots, options);

  assert.equal(result.winnerId, "tacos");
  assert.equal(result.rounds.length, 3);

  // Round 1: 2-2-1-1, need 4. Sushi and Thai tie; Thai is on fewer ballots.
  assert.deepEqual(result.rounds[0].tallies, { tacos: 2, pizza: 2, sushi: 1, thai: 1 });
  assert.equal(result.rounds[0].needed, 4);
  assert.equal(result.rounds[0].eliminated, "thai");
  assert.deepEqual(result.rounds[0].tiedForLast, ["sushi", "thai"]);
  assert.equal(result.rounds[0].tieBreak, "appearances");

  // Round 2: the Thai voter's #2 was Tacos. Sushi is last.
  assert.deepEqual(result.rounds[1].tallies, { tacos: 3, pizza: 2, sushi: 1 });
  assert.equal(result.rounds[1].eliminated, "sushi");

  // Round 3: the Sushi voter's #2 was Tacos. 4–2.
  assert.deepEqual(result.rounds[2].tallies, { tacos: 4, pizza: 2 });
  assert.equal(result.rounds[2].winner, "tacos");
});

test("a majority in round 1 ends immediately", () => {
  const result = countVotes(
    [["a"], ["a"], ["b"]],
    [opt("a"), opt("b")],
  );
  assert.equal(result.winnerId, "a");
  assert.equal(result.rounds.length, 1);
  assert.equal(result.rounds[0].needed, 2);
});

test("exhausted ballots stop counting toward the majority", () => {
  // Voter 5 only ranked "c". Once c is out, that ballot is exhausted,
  // so 4 ballots are still active and 3 votes are enough.
  const options = [opt("a"), opt("b"), opt("c")];
  const ballots = [["a"], ["a"], ["b", "a"], ["b"], ["c"]];
  const result = countVotes(ballots, options);

  assert.equal(result.rounds[0].eliminated, "c");
  assert.equal(result.rounds[1].exhausted, 1);
  assert.equal(result.rounds[1].needed, 3);
  assert.equal(result.winnerId, "a"); // b is eliminated next; b's #2 is a
});

test("a tie on appearances falls back to score, then rating", () => {
  const byScore = countVotes(
    [["a"], ["b"], ["c"], ["c"]],
    [opt("a", 5), opt("b", 9), opt("c")],
  );
  assert.equal(byScore.rounds[0].eliminated, "a"); // lower score than b
  assert.equal(byScore.rounds[0].tieBreak, "score");

  const byRating = countVotes(
    [["a"], ["b"], ["c"], ["c"]],
    [opt("a", 5, 4.8), opt("b", 5, 4.1), opt("c")],
  );
  assert.equal(byRating.rounds[0].eliminated, "b"); // lower rating than a
  assert.equal(byRating.rounds[0].tieBreak, "rating");
});

test("a 50/50 final round is still decided by the tie-break", () => {
  const result = countVotes(
    [["a"], ["b"]],
    [opt("a", 1, 4.0), opt("b", 1, 4.5)],
  );
  assert.equal(result.winnerId, "b"); // higher Google rating wins
});

test("no ballots picks the highest-scored option", () => {
  const result = countVotes([], [opt("a", 3), opt("b", 7)]);
  assert.equal(result.winnerId, "b");
  assert.equal(result.decidedBy, "no-votes");
});

test("unknown ids and duplicates on a ballot are ignored", () => {
  const result = countVotes(
    [["zzz", "a", "a"], ["b"], ["a"]],
    [opt("a"), opt("b")],
  );
  assert.equal(result.winnerId, "a");
  assert.deepEqual(result.rounds[0].tallies, { a: 2, b: 1 });
});
