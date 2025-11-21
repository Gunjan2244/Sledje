export async function sendOtpEmail({ to, otp }) {
  // Replace with real email sender
  console.log(`\n[EMAIL STUB] Sending OTP ${otp} to ${to}\n`);
  return true;
}
import nodemailer from "nodemailer";

export function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    }
  });
}

export async function sendInvoiceEmail({ to, subject, text, pdfPath }) {
  const transporter = getTransporter();

  const mailOptions = {
    from: `"SLEDJE" <${process.env.MAIL_USER}>`,
    to,
    subject,
    text,
    attachments: [
      {
        filename: pdfPath.split("/").pop(),
        path: pdfPath
      }
    ]
  };

  await transporter.sendMail(mailOptions);
}
