// Express Server handle Socket

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const httpServer = createServer(app);

app.use(
  cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
  }),
);

const PORT = 4000;

const io = new Server(httpServer, {
  cors: {
    credentials: true,
    origin: process.env.CLIENT_URL,
  },
});

io.on("connection", async (socket) => {
  socket.on("message", (data) => io.emit("message", data));
});

httpServer.listen(PORT, () => {
  console.log(`Server is listening on Port: ${PORT}`);
});
