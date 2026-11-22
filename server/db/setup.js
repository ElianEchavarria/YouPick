// Creates the tables from schema.sql.  Run with: npm run db:setup
// Safe to run more than once: every statement uses IF NOT EXISTS.

import { readFile } from "node:fs/promises";
import { pool } from "./pool.js";

if (!pool) {
  console.error(
    "DATABASE_URL isn't set (in .env locally, or in your host's environment settings), so there's no database to set up.",
  );
  process.exit(1);
}

try {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(schema); // a query with no parameters can contain several statements
  console.log("Tables are ready: sessions, participants, options, ballots.");
} catch (err) {
  console.error(`Setup failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end(); // close the connections so the script can exit
}
