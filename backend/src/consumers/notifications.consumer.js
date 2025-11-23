import { createConsumer } from "./utils/js-consumer.js";

export default async function startNotificationConsumer() {
  await createConsumer(
     "notifications.>",
     "notify_handler",
    async (data) => {
      console.log("🔔 Notification event:", data);
      // Socket forwarding handled by socket-server; here you may store logs, email, sms, etc.
    },
  );
}
