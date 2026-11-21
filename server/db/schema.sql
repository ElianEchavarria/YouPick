-- YouPick database schema.
-- Run it with: npm run db:setup
-- "IF NOT EXISTS" makes it safe to run again; it never deletes data.
--
-- One session (a decision) has many participants, many ballot options,
-- and one ballot per participant who voted:
--
--   sessions ─┬─< participants ──< ballots
--             └─< options

CREATE TABLE IF NOT EXISTS sessions (
  id              text PRIMARY KEY,               -- the short link id, e.g. 'k7Qp2'
  title           text NOT NULL,
  location_lat    double precision NOT NULL,
  location_lng    double precision NOT NULL,
  location_label  text NOT NULL,
  deadline        timestamptz NOT NULL,           -- the moment time runs out
  stage           text NOT NULL
                  CHECK (stage IN ('lobby', 'preferences', 'voting', 'results')),
  host_guest_id   text NOT NULL,                  -- the creator's guest cookie
  notice          text,                           -- e.g. 'Widened to 3 miles…'
  result          jsonb,                          -- the ranked-choice result, rounds and all
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participants (
  session_id  text NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  guest_id    text NOT NULL,                      -- secret: from the cookie, never sent to browsers
  public_id   text NOT NULL,                      -- safe to show: used as the React key
  name        text NOT NULL,
  prefs       jsonb,                              -- { cuisines, hardNos, budget, distance, dietary }
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, guest_id)              -- one row per person per session
);

CREATE TABLE IF NOT EXISTS options (
  session_id  text NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  id          text NOT NULL,                      -- Google place id
  position    integer NOT NULL,                   -- order on the ballot (0 = top score)
  name        text NOT NULL,                      -- copied out of data so it's easy to read in Postico
  cuisine     text,
  rating      real,
  score       real,
  data        jsonb NOT NULL,                     -- the full place: address, price, photo, etc.
  PRIMARY KEY (session_id, id)
);

CREATE TABLE IF NOT EXISTS ballots (
  session_id    text NOT NULL,
  guest_id      text NOT NULL,
  ranking       text[] NOT NULL,                  -- option ids, favorite first
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, guest_id),             -- one ballot per person; changing your vote replaces it
  FOREIGN KEY (session_id, guest_id)
    REFERENCES participants (session_id, guest_id) ON DELETE CASCADE
);

-- For browsing history newest-first (e.g. "where did we go last Friday?").
CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON sessions (created_at DESC);
