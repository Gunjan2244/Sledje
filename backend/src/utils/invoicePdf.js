import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export async function generateInvoicePDF(invoice, invoiceItems, retailer, distributor) {
  return new Promise((resolve, reject) => {
    try {
      const filePath = path.resolve(`./invoices/invoice-${invoice.id}.pdf`);

      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text("INVOICE", { align: "center" });
      doc.moveDown();

      // Parties
      doc.fontSize(11).text(`Invoice ID: ${invoice.id}`);
      doc.text(`Period: ${invoice.periodStart.toISOString().slice(0,10)} → ${invoice.periodEnd.toISOString().slice(0,10)}`);
      doc.moveDown();

      doc.fontSize(13).text("Retailer:", { underline: true });
      doc.fontSize(11).text(retailer.businessName);
      doc.text(retailer.address || "");
      doc.moveDown();

      doc.fontSize(13).text("Distributor:", { underline: true });
      doc.fontSize(11).text(distributor.companyName);
      doc.text(distributor.address || "");

      doc.moveDown();

      // Table Header
      doc.fontSize(13).text("Invoice Items", { underline: true });
      doc.moveDown();

      // Table
      invoiceItems.forEach(item => {
        doc.fontSize(10)
          .text(`Variant: ${item.variantId}`)
          .text(`Quantity: ${item.quantity}`)
          .text(`Unit Price: ₹${item.unitPrice}`)
          .text(`Amount: ₹${item.amount}`)
          .moveDown();
      });

      doc.moveDown();
      doc.fontSize(14).text(`TOTAL: ₹${invoice.totalAmount}`);

      doc.end();

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);

    } catch (err) {
      reject(err);
    }
  });
}
