import "dotenv/config";
import http from "http";
import express from "express";
import app from "./app.js";
import { initNats } from "./config/nats.js";
import startSocketServer from "./realtime/socket.server.js";
import startAllConsumers from "./consumers/index.js";

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // 1️⃣ Initialize NATS FIRST
    await initNats();

    // 2️⃣ Create HTTP server
    const server = http.createServer(app);

    // 3️⃣ Start socket.io (uses NATS, so safe after init)
    startSocketServer(server);

    // 4️⃣ Start all NATS consumers (MUST await)
    await startAllConsumers();

    // 5️⃣ Start HTTP listener
    server.listen(PORT, () => {
      console.log(`🌐 Server listening on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
