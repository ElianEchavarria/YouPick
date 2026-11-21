// The rules of a session: who can do what, in which stage, and what happens
// next. Routes and socket handlers stay thin and call into these functions.
//
//   lobby ──host──▶ preferences ──host──▶ voting ──host / everyone voted / timer──▶ results
//
// The server owns the stage. Browsers only ask for changes; this file decides.
//
// Storage: the sessions Map (store.js) is the fast working copy, and every
// change is also saved to PostgreSQL (db/repo.js). Each change is saved to
// the database FIRST and copied into memory only once that worked, so if a
// save fails, memory and the database never disagree.

import { randomBytes } from "node:crypto";
import { BALLOT_MIN_RANKED, BUDGETS, DISTANCES, isCuisineKey, isDietKey } from "../shared/catalog.js";
import { buildBallot } from "./ballot.js";
import * as db from "./db/repo.js";
import { UserError } from "./errors.js";
import { searchNearby } from "./places.js";
import { countVotes } from "./rcv.js";
import { broadcastSession } from "./realtime.js";
import { MAX_AGE_MS, sessions } from "./store.js";

// If voting starts with less time than this left, the deadline is pushed
// back so people actually get a chance to vote.
const MIN_VOTING_MS = 2 * 60 * 1000;

// ---------------------------------------------------------------------------
// Finding a session
// ---------------------------------------------------------------------------

// Sessions that are being loaded from the database right now, so two
// requests arriving together after a restart share one load instead of
// creating two separate copies of the same session.
const loading = new Map();

/**
 * Get a session: from memory if it's there, otherwise from the database
 * (e.g. after the server restarted). Returns null if it doesn't exist or has
 * expired. Finished decisions stay viewable; unfinished ones expire after a day.
 */
export async function getSession(id) {
  if (typeof id !== "string" || id.length > 20) return null;

  const cached = sessions.get(id);
  if (cached) return cached;

  if (!loading.has(id)) {
    const load = (async () => {
      try {
        const session = await db.loadSession(id);
        if (!session) return null;
        const expired = session.stage !== "results" && session.createdAt < Date.now() - MAX_AGE_MS;
        if (expired) return null;
        sessions.set(id, session);
        // Timers don't survive a restart, so start this session's timer again.
        if (session.stage !== "results") scheduleDeadline(session);
        return session;
      } finally {
        loading.delete(id);
      }
    })();
    loading.set(id, load);
  }
  return loading.get(id);
}

export async function createSession(session) {
  await db.insertSession(session);
  sessions.set(session.id, session);
  scheduleDeadline(session);
}

// ---------------------------------------------------------------------------
// Permission checks
// ---------------------------------------------------------------------------

function requireHost(session, guestId) {
  if (!guestId || session.hostId !== guestId) {
    throw new UserError("Only the host can do that.", 403);
  }
}

function requireParticipant(session, guestId) {
  const participant = guestId && session.participants[guestId];
  if (!participant) throw new UserError("Join the session first.", 403);
  return participant;
}

function requireStage(session, stage, message) {
  if (session.stage !== stage) throw new UserError(message, 409);
}

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

export async function joinSession(session, guestId, rawName) {
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 30) : "";
  if (!name) throw new UserError("Name is required.");

  const existing = session.participants[guestId];
  // Reopened the link: keep their prefs and vote, just update the name.
  const participant = existing
    ? { ...existing, name }
    : { publicId: randomBytes(4).toString("hex"), name, prefs: null, ballot: null };

  await db.saveParticipant(session.id, guestId, participant);
  session.participants[guestId] = participant;
  broadcastSession(session);
}

// ---------------------------------------------------------------------------
// Moving between stages
// ---------------------------------------------------------------------------

export async function advanceStage(session, guestId) {
  requireHost(session, guestId);

  switch (session.stage) {
    case "lobby":
      await db.updateSession({ ...session, stage: "preferences" });
      session.stage = "preferences";
      broadcastSession(session);
      return;
    case "preferences":
      await startVoting(session);
      return;
    case "voting":
      await finishVoting(session);
      return;
    default:
      throw new UserError("This decision is already settled.", 409);
  }
}

async function startVoting(session) {
  if (session.building) throw new UserError("Already building the ballot…", 409);

  // Tell everyone the ballot is on its way, since the search can take a second.
  session.building = true;
  session.notice = null;
  broadcastSession(session);

  try {
    const allPrefs = Object.values(session.participants).map((p) => p.prefs);
    const { options, notice } = await buildBallot({
      origin: session.location,
      allPrefs,
      search: searchNearby,
    });

    if (options.length === 0) {
      throw new UserError(
        "No open restaurants fit everyone's filters, even after widening the search. Ask people to loosen their hard no's or dietary needs, then try again.",
      );
    }
    if (options.length === 1) {
      throw new UserError(
        `Only one place fits everyone: ${options[0].name}. Ask people to loosen their hard no's or dietary needs to get a real choice.`,
      );
    }

    const changes = {
      options,
      notice,
      stage: "voting",
      deadline: Math.max(session.deadline, Date.now() + MIN_VOTING_MS),
    };
    await db.saveOptions(session.id, options);
    await db.updateSession({ ...session, ...changes });

    const deadlineMoved = changes.deadline !== session.deadline;
    Object.assign(session, changes);
    if (deadlineMoved) scheduleDeadline(session);
  } finally {
    // Runs whether building worked or threw, so the spinner never gets stuck.
    session.building = false;
    broadcastSession(session);
  }
}

async function finishVoting(session) {
  // The timer, the host and the last voter could all finish voting at the
  // same moment; only the first one counts.
  if (session.stage !== "voting" || session.finishing) return;
  session.finishing = true;

  try {
    const ballots = Object.values(session.participants)
      .map((p) => p.ballot)
      .filter(Boolean);
    const result = countVotes(ballots, session.options);

    await db.updateSession({ ...session, stage: "results", result });
    session.result = result;
    session.stage = "results";
    clearTimeout(session.timer);
    broadcastSession(session);
  } finally {
    session.finishing = false;
  }
}

// ---------------------------------------------------------------------------
// Preferences and votes
// ---------------------------------------------------------------------------

export async function submitPrefs(session, guestId, raw) {
  const participant = requireParticipant(session, guestId);
  requireStage(session, "preferences", "Preferences are closed.");
  if (session.building) throw new UserError("The ballot is already being built.", 409);

  const prefs = validatePrefs(raw);
  await db.saveParticipant(session.id, guestId, { ...participant, prefs });
  participant.prefs = prefs;
  broadcastSession(session);
}

// Check everything: anyone can send anything over a socket, not just our form.
function validatePrefs(raw) {
  if (!raw || typeof raw !== "object") throw new UserError("Preferences are missing.");

  const keyList = (value, isValid, field) => {
    if (value == null) return [];
    if (!Array.isArray(value) || !value.every((k) => typeof k === "string" && isValid(k))) {
      throw new UserError(`Invalid ${field}.`);
    }
    return [...new Set(value)];
  };

  const cuisines = keyList(raw.cuisines, isCuisineKey, "cuisines");
  const hardNos = keyList(raw.hardNos, isCuisineKey, "hard no's");
  const dietary = keyList(raw.dietary, isDietKey, "dietary needs");

  const budget = Number(raw.budget);
  if (!BUDGETS.includes(budget)) throw new UserError("Pick a budget.");
  const distance = Number(raw.distance);
  if (!DISTANCES.includes(distance)) throw new UserError("Pick a distance.");

  if (cuisines.some((k) => hardNos.includes(k))) {
    throw new UserError("A cuisine can't be both a pick and a hard no.");
  }

  return { cuisines, hardNos, budget, distance, dietary };
}

export async function submitBallot(session, guestId, ranking) {
  const participant = requireParticipant(session, guestId);
  requireStage(session, "voting", "Voting is closed.");

  if (!Array.isArray(ranking) || !ranking.every((id) => typeof id === "string")) {
    throw new UserError("Invalid ballot.");
  }
  const optionIds = new Set(session.options.map((o) => o.id));
  if (new Set(ranking).size !== ranking.length) throw new UserError("Each place can only be ranked once.");
  if (!ranking.every((id) => optionIds.has(id))) throw new UserError("That place isn't on the ballot.");
  const min = Math.min(BALLOT_MIN_RANKED, session.options.length);
  if (ranking.length < min) throw new UserError(`Rank at least your top ${min}.`);

  await db.saveBallot(session.id, guestId, ranking);
  participant.ballot = ranking;

  // Everyone's in: no need to wait for the timer or the host.
  const everyoneVoted = Object.values(session.participants).every((p) => p.ballot);
  if (everyoneVoted) await finishVoting(session);
  else broadcastSession(session);
}

// ---------------------------------------------------------------------------
// The deadline timer (the backup when the host doesn't advance)
// ---------------------------------------------------------------------------

export function scheduleDeadline(session) {
  clearTimeout(session.timer);
  const ms = Math.max(0, session.deadline - Date.now());
  session.timer = setTimeout(() => {
    onDeadline(session).catch((err) => console.error("Deadline handler failed:", err));
  }, ms);
}

// Time's up. If people are still in the lobby or picking preferences, build
// the ballot with whatever preferences exist (startVoting also gives voting a
// couple of minutes). If voting is open, count the votes.
async function onDeadline(session) {
  if (sessions.get(session.id) !== session) return; // removed from memory already

  if (session.stage === "lobby" || session.stage === "preferences") {
    try {
      await startVoting(session);
    } catch (err) {
      session.notice =
        err instanceof UserError
          ? `Time's up, but the ballot couldn't be built. ${err.message}`
          : "Time's up, but something went wrong building the ballot. The host can try again.";
      if (!(err instanceof UserError)) console.error(err);
      await db.updateSession(session).catch((e) => console.error("Saving notice failed:", e));
      broadcastSession(session);
    }
  } else if (session.stage === "voting") {
    await finishVoting(session);
  }
}
