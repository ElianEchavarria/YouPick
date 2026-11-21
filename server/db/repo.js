// Every SQL query the app runs lives here, so the rest of the code never
// writes SQL. ("repo" is short for repository: the one place that knows how
// data is stored.)
//
// Values always go in as $1, $2, … parameters, never pasted into the SQL
// string. pg sends them separately from the query, so a name like
// "Robert'); DROP TABLE sessions;--" is stored as plain text instead of being
// run as SQL (that attack is called SQL injection).
//
// When there's no database (pool is null), every function does nothing, so
// the app still works in memory only.

import { pool } from "./pool.js";

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

// A brand-new session. Plain INSERT (not "insert or update"), so a reused id
// fails loudly instead of overwriting an old decision.
export async function insertSession(s) {
  if (!pool) return;
  await pool.query(
    `INSERT INTO sessions
       (id, title, location_lat, location_lng, location_label, deadline, stage, host_guest_id, notice, result, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      s.id,
      s.title,
      s.location.lat,
      s.location.lng,
      s.location.label,
      new Date(s.deadline),
      s.stage,
      s.hostId,
      s.notice,
      json(s.result),
      new Date(s.createdAt),
    ],
  );
}

// The parts of a session that change after it's created.
export async function updateSession(s) {
  if (!pool) return;
  await pool.query(
    `UPDATE sessions
        SET deadline = $2, stage = $3, notice = $4, result = $5, updated_at = now()
      WHERE id = $1`,
    [s.id, new Date(s.deadline), s.stage, s.notice, json(s.result)],
  );
}

// Add a participant, or update their name/prefs if they're already there.
// ON CONFLICT is Postgres's "insert or update" (often called an upsert).
export async function saveParticipant(sessionId, guestId, p) {
  if (!pool) return;
  await pool.query(
    `INSERT INTO participants (session_id, guest_id, public_id, name, prefs)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id, guest_id)
     DO UPDATE SET name = EXCLUDED.name, prefs = EXCLUDED.prefs`,
    [sessionId, guestId, p.publicId, p.name, json(p.prefs)],
  );
}

// Replace the whole ballot list. A transaction (BEGIN … COMMIT) makes the
// delete and inserts happen all together or not at all, so nobody can ever
// load a session with half its options saved.
export async function saveOptions(sessionId, options) {
  if (!pool) return;
  const client = await pool.connect(); // a transaction needs one dedicated connection
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM options WHERE session_id = $1", [sessionId]);
    for (const [position, o] of options.entries()) {
      // photoUrl / photoUrlAt are a short-lived cache, not worth storing.
      const data = { ...o };
      delete data.photoUrl;
      delete data.photoUrlAt;
      await client.query(
        `INSERT INTO options (session_id, id, position, name, cuisine, rating, score, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [sessionId, o.id, position, o.name, o.cuisine, o.rating, o.score, json(data)],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK"); // undo everything since BEGIN
    throw err;
  } finally {
    client.release(); // give the connection back to the pool
  }
}

export async function saveBallot(sessionId, guestId, ranking) {
  if (!pool) return;
  await pool.query(
    `INSERT INTO ballots (session_id, guest_id, ranking)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, guest_id)
     DO UPDATE SET ranking = EXCLUDED.ranking, submitted_at = now()`,
    [sessionId, guestId, ranking], // a JS array becomes a Postgres text[] automatically
  );
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

// Rebuild the in-memory session object (same shape as in store.js) from the
// database. Returns null if there's no such session.
export async function loadSession(id) {
  if (!pool) return null;

  const { rows: sessionRows } = await pool.query("SELECT * FROM sessions WHERE id = $1", [id]);
  const row = sessionRows[0];
  if (!row) return null;

  // LEFT JOIN keeps participants who haven't voted (their ranking is null).
  const { rows: people } = await pool.query(
    `SELECT p.guest_id, p.public_id, p.name, p.prefs, b.ranking
       FROM participants p
       LEFT JOIN ballots b USING (session_id, guest_id)
      WHERE p.session_id = $1
      ORDER BY p.joined_at`,
    [id],
  );

  const { rows: optionRows } = await pool.query(
    "SELECT data FROM options WHERE session_id = $1 ORDER BY position",
    [id],
  );

  // pg already turns jsonb into objects, text[] into arrays and timestamptz
  // into Date objects, so this is mostly renaming columns.
  return {
    id: row.id,
    title: row.title,
    location: { lat: row.location_lat, lng: row.location_lng, label: row.location_label },
    deadline: row.deadline.getTime(),
    stage: row.stage,
    hostId: row.host_guest_id,
    participants: Object.fromEntries(
      people.map((p) => [
        p.guest_id,
        { publicId: p.public_id, name: p.name, prefs: p.prefs, ballot: p.ranking },
      ]),
    ),
    options: optionRows.map((o) => o.data),
    notice: row.notice,
    result: row.result,
    building: false,
    timer: null,
    createdAt: row.created_at.getTime(),
  };
}

// pg would turn a JS array into a Postgres array, not JSON, so jsonb values
// are converted to JSON text explicitly. null stays null.
function json(value) {
  return value == null ? null : JSON.stringify(value);
}
