import { createConsumer } from "./utils/js-consumer.js";

export default async function startNotificationConsumer() {
  await createConsumer({
    subject: "notifications.>",
    durable: "notify_handler",
    handler: async (data) => {
      console.log("🔔 Notification event:", data);
      // Socket forwarding handled by socket-server; here you may store logs, email, sms, etc.
    },
  });
}
