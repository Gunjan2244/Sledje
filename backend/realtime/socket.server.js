import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { initNats } from "../config/nats.js";
import { StringCodec } from "nats";
import { ensureEventsStream } from "../config/nats-streams.js";

const JWT_SECRET = process.env.JWT_SECRET || "please_change_this";

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
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

  io.use((socket, next) => {
    const token =
      socket.handshake.query?.token || socket.handshake.auth?.token || null;
    if (!token) return next(new Error("Authentication error: token missing"));

    const payload = verifyToken(token);
    if (!payload) return next(new Error("Authentication error: invalid token"));

    socket.user = payload;
    next();
  });

  io.on("connection", (socket) => {
    const uid = socket.user.id;
    socket.join(`user:${uid}`);
    if (socket.user.role) socket.join(`role:${socket.user.role}`);

    console.log(`🔌 Socket connected: ${uid}`);
  });

  initNats()
    .then(async (nc) => {
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
      ];

      // notifications must use broadcast since wildcard cannot use durable
      subjects.push("notifications.>");

      for (const subject of subjects) {
        (async () => {
          try {
            const durable =
              subject.includes("*") || subject.includes(">") ? undefined :
              `sock_${subject.replace(/\./g, "_")}`;

            const opts = durable
              ? { durable, deliver_policy: "all" }
              : { deliver_policy: "all" }; // wildcards cannot be durable

            const sub = await js.subscribe(subject, opts);
            console.log(`🔗 Subscribed to: ${subject}  ${durable ? "(durable)" : "(ephemeral)"}`);

            for await (const msg of sub) {
              try {
                const payload = JSON.parse(sc.decode(msg.data));

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
                if (payload.userId) targets.push(`user:${payload.userId}`);
                if (payload.role) targets.push(`role:${payload.role}`);

                targets = [...new Set(targets)];
                const envelope = { subject, payload };

                if (targets.length === 0) io.emit("event", envelope);
                else targets.forEach((room) => io.to(room).emit("event", envelope));

                msg.ack();
              } catch (err) {
                console.error("Socket forward error:", err);
              }
            }
          } catch (err) {
            console.error(`Failed subscribe ${subject}:`, err);
          }
        })();
      }
    })
    .catch((err) => console.error("NATS init failed:", err));
}
