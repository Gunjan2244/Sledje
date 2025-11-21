import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export async function sendOtpEmail(to, otp) {
  const subject = "Your OTP code";
  const text = `Your OTP code is ${otp}. It expires in 10 minutes.`;

  if (transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || SMTP_USER,
      to,
      subject,
      text,
    });
    return;
  }

  // Fallback — log to console (useful in development)
  console.log(`[DEV EMAIL] To: ${to}, Subject: ${subject}, Text: ${text}`);
}
