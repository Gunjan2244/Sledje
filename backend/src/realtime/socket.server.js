import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { initNats } from "../config/nats.js";
import { StringCodec, consumerOpts } from "nats";
import { ensureEventsStream } from "../config/nats-streams.js";

const JWT_SECRET = process.env.JWT_SECRET || "please_change_this";

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export default function startSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  /** SOCKET AUTH */
  io.use((socket, next) => {
    const token = socket.handshake.query?.token || socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error: missing token"));

    const payload = verifyToken(token);
    if (!payload) return next(new Error("Authentication error: invalid token"));

    socket.user = payload;
    next();
  });

  io.on("connection", (socket) => {
    const uid = socket.user.id;

    console.log(`🔌 Socket connected → user:${uid}, socket:${socket.id}`);

    socket.join(`user:${uid}`);
    if (socket.user.role) socket.join(`role:${socket.user.role}`);

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected ${socket.id}`);
    });
  });

  /** NATS + JetStream setup */
  (async () => {
    const nc = await initNats();

    await ensureEventsStream(nc);

    const js = nc.jetstream();
    const sc = StringCodec();

    const subjects = [
      "orders.created",
      "orders.modified",
      "orders.accepted",
      "orders.status.updated",
      "orders.completed",
      "connections.requested",
      "connections.approved",
      "connections.rejected",
      "inventory.variant_added",
      "inventory.updated_after_order",
      "notifications.>"
    ];

    for (const subject of subjects) {
      try {
        const durableName = `socket_${subject.replace(/\W/g, "_")}`;

        const opts = consumerOpts();
        opts.durable(durableName);
        opts.manualAck();
        opts.deliverTo(`inbox_${durableName}_${Date.now()}`);
        opts.ackExplicit();   // IMPORTANT — FIXES ackPolicy error
        opts.deliverAll();    // deliver_policy: "all"
        opts.filterSubject(subject);

        const sub = await js.subscribe(subject, opts);

        console.log(`🔗 Subscribed → ${subject}`);

        (async () => {
          for await (const msg of sub) {
            try {
              const payload = JSON.parse(sc.decode(msg.data));
              const envelope = { subject, payload };

              let targets = [];

              if (payload.order) {
                if (payload.order.retailerId)
                  targets.push(`user:${payload.order.retailerId}`);
                if (payload.order.distributorId)
                  targets.push(`user:${payload.order.distributorId}`);
              }

              if (payload.retailerId)
                targets.push(`user:${payload.retailerId}`);
              if (payload.distributorId)
                targets.push(`user:${payload.distributorId}`);
              if (payload.userId)
                targets.push(`user:${payload.userId}`);

              if (payload.role)
                targets.push(`role:${payload.role}`);

              targets = [...new Set(targets)];

              if (targets.length === 0)
                io.emit("event", envelope);
              else
                targets.forEach(room => io.to(room).emit("event", envelope));

              msg.ack();
            } catch (e) {
              console.error("Socket message error:", e);
            }
          }
        })();

      } catch (err) {
        console.error(`❌ Failed to subscribe ${subject}:`, err);
      }
    }
  })();
}
