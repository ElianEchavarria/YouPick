// The Express server: REST routes, Socket.IO, and (in production) the built
// React app. In development, Vite serves React on 5173 and proxies /api and
// /socket.io here.

import cookieParser from "cookie-parser";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { checkDatabase } from "./db/pool.js";
import { UserError } from "./errors.js";
import { usingDemoPlaces } from "./places.js";
import { setIo } from "./realtime.js";
import placesRouter from "./routes/places.js";
import sessionRouter from "./routes/session.js";
import { registerSocketHandlers } from "./sockets.js";
import { startCleanup } from "./store.js";

const PORT = Number(process.env.PORT) || 4000; // hosts like Render set PORT for you
const isProduction = process.env.NODE_ENV === "production";

const app = express();
const httpServer = createServer(app);

// Hosts put a proxy in front of the app; this lets Express see the real
// protocol (https) and client IP through it.
app.set("trust proxy", 1);

app.use(express.json({ limit: "20kb" })); // nothing we accept is bigger than this
app.use(cookieParser());

// No CORS setup: the browser always talks to one address (Vite's proxy in
// development, this server in production), so nothing is cross-origin.

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/sessions", sessionRouter);
app.use("/api/places", placesRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// Production: serve the built React app (npm run build → dist/). Any other
// path, like a shared /s/k7Qp2 link, gets index.html and React Router takes
// over. Without that catch-all, opening a shared link would 404.
if (isProduction) {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

// Errors from any route end up here (Express 5 also catches errors thrown in
// async routes). UserErrors are shown to the user; anything else is logged
// and replaced with a generic message.
app.use((err, _req, res, _next) => {
  if (err instanceof UserError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

// Stop right here with a clear message if the database is unreachable or
// its tables are missing. (Top-level await works because this is an ES module.)
await checkDatabase();

const io = new Server(httpServer);
setIo(io);
registerSocketHandlers(io);
startCleanup();

httpServer.listen(PORT, () => {
  console.log(`Server is listening on Port: ${PORT}`);
  if (usingDemoPlaces) {
    console.log("Using demo restaurants: set a real GOOGLE_PLACES_KEY in .env to search Google Places.");
  }
});
