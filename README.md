# YouPick: Group Chat Decision Settler

Paste one link in the group chat, get a fair answer in two minutes.

One person starts a decision, everyone opens the link and types a name (no accounts), drops
their preferences, ranks a short list of nearby restaurants, and a ranked-choice count picks
the place the group is happiest with overall.

## Run it locally

You need two terminals:

```sh
npm install

npm run dev          # terminal 1: React on http://localhost:5173
npm run dev:server   # terminal 2: Express + Socket.IO on port 4000
```

Open http://localhost:5173. Vite forwards `/api` and `/socket.io` to the Express server.

To test with several people on one computer, use a normal window plus incognito windows:
each has its own cookie, so each acts as a different guest.

### Google Places

Put your key in `.env`:

```
GOOGLE_PLACES_KEY=AIza...
```

The key needs the **Places API (New)** enabled in Google Cloud. Without a real key, the
server uses made-up demo restaurants (see `server/fixtures.js`) and the app shows a
"Demo mode" banner.

### Database (PostgreSQL)

Optional. Without it, sessions live in memory and disappear when the server restarts.

1. Create a database, e.g. `createdb youpick_dev`.
2. Add it to `.env`: `DATABASE_URL=postgresql://user:password@localhost:5432/youpick_dev`.
   Hosted databases usually need `?sslmode=require` at the end.
3. Create the tables: `npm run db:setup` (safe to run again; it never deletes data).
4. Restart `npm run dev:server`. It should print `Connected to PostgreSQL.`

Tables: `sessions`, `participants`, `options` and `ballots` (see `server/db/schema.sql`).
All queries live in `server/db/repo.js`.

## Tests

```sh
npm test
```

Covers the ranked-choice count (`server/rcv.js`) and the ballot builder (`server/ballot.js`),
including the 6-friend worked example from the spec.

## How the code is organized

```
shared/catalog.js      cuisines, budgets, distances: used by both React and the server
server/
  index.js             Express app, Socket.IO, production static serving
  routes/session.js    create / load / join a session, option photos
  routes/places.js     turn a typed area into a location
  sockets.js           live events: watch, advance stage, submit prefs, submit vote
  flow.js              the rules: who can do what in which stage, the deadline timer
  ballot.js            ballot builder: filter, score, relax distance then budget
  rcv.js               instant-runoff count with tie-breaks
  places.js            Google Places API (New) client
  fixtures.js          demo restaurants for when there's no key
  store.js             in-memory sessions and what each browser is allowed to see
  realtime.js          sends each viewer their own copy of session updates
  guest.js             the guest cookie
  db/schema.sql        the tables
  db/setup.js          npm run db:setup
  db/pool.js           the PostgreSQL connection and startup check
  db/repo.js           every SQL query
src/
  pages/Home.jsx       create a decision
  pages/Session.jsx    join + one screen per stage
  useSession.js        load a session over HTTP, then keep it live over Socket.IO
  components/          Lobby, PreferencesForm, Voting, Results, etc.
```

Active sessions are kept in memory for speed and saved to PostgreSQL on every change. After
a restart, a session is loaded back from the database the first time someone opens its link.

## Deploy

```sh
npm run build   # React → dist/
npm start       # Express serves dist/ plus the API and sockets on one port
```

Use a host that runs a long-lived Node server (Render, Railway, Fly.io). Serverless hosts
like Vercel functions can't keep Socket.IO connections open. Set `GOOGLE_PLACES_KEY` in the
host's environment settings. The host sets `PORT` for you.
