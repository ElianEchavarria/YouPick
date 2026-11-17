// Express Server handle Socket

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import sessionRouter from "./routes/session.js";
import cookieParser from "cookie-parser";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
  }),
);

// app.use("/api/health", healthRouter);

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const PORT = 4000;

const io = new Server(httpServer, {
  cors: {
    credentials: true,
    origin: process.env.CLIENT_URL,
  },
});

io.on("connection", (socket) => {});

app.use("/api/sessions", sessionRouter);

httpServer.listen(PORT, () => {
  console.log(`Server is listening on Port: ${PORT}`);
});
