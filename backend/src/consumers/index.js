import startOutboxConsumer from "./outbox.consumer.js";
import startInventoryConsumers from "./inventory.consumer.js";
import startProductBillConsumer from "./productBill.consumer.js";
import startLedgerConsumer from "./ledger.consumer.js";
import startPaymentConsumer from "./payment.consumer.js";
import startNotificationConsumer from "./notifications.consumer.js";

export default async function startAllConsumers() {
  console.log("🚀 Starting all consumers...");

  await startOutboxConsumer();
  await startInventoryConsumers();
  await startProductBillConsumer();
  await startLedgerConsumer();
  await startPaymentConsumer();
  await startNotificationConsumer();

  console.log("✅ All consumers running.");
}
