import "dotenv/config";
import http from "http";
import express from "express";
import app from "./app.js"; // your existing express app
import { initNats } from "./config/nats.js";
import startSocketServer from "./realtime/socket.server.js";

const PORT = process.env.PORT || 5000;

async function start() {
  // init NATS for other things too
  await initNats();

  const server = http.createServer(app);
  // start socket.io server
  startSocketServer(server);

  server.listen(PORT, () => {
    console.log(`🌐 Server listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
