// The connection to PostgreSQL.
//
// A "pool" keeps a few connections open and lends one out for each query,
// which is much faster than connecting fresh every time.
//
// If DATABASE_URL isn't set, pool is null and the app runs in memory only
// (sessions are lost on restart, like before the database existed).
//
// Hosted databases (Render, Railway, Neon…) usually need SSL. Add
// ?sslmode=require to the end of DATABASE_URL and pg handles it.

import pg from "pg";

const url = process.env.DATABASE_URL?.trim();

export const pool = url ? new pg.Pool({ connectionString: url, max: 10 }) : null;
export const usingDatabase = Boolean(pool);

// Without this, a dropped idle connection (database restarted, wifi blip)
// would crash the whole server. The pool replaces the connection by itself.
pool?.on("error", (err) => {
  console.error("PostgreSQL connection error:", err.message);
});

// Run at startup, so a wrong URL or missing tables fail loudly right away
// instead of on the first person's click.
export async function checkDatabase() {
  if (!pool) {
    console.log("No DATABASE_URL: sessions are kept in memory only.");
    return;
  }
  try {
    // to_regclass returns null if the table doesn't exist.
    const { rows } = await pool.query("SELECT to_regclass('public.sessions') AS sessions_table");
    if (!rows[0].sessions_table) {
      console.error("Connected to PostgreSQL, but the tables don't exist yet. Run: npm run db:setup");
      process.exit(1);
    }
    console.log("Connected to PostgreSQL.");
  } catch (err) {
    console.error(`Could not connect to PostgreSQL: ${err.message}`);
    console.error("Check DATABASE_URL in .env and that Postgres is running.");
    process.exit(1);
  }
}
