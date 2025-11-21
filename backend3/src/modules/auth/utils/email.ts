import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendOtpEmail(to: string, otp: string) {
  const from = process.env.EMAIL_FROM || 'no-reply@example.com';
  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Your verification code',
    text: `Your OTP is ${otp}. It is valid for 10 minutes.`
  });
  return info;
}
