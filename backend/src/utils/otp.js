import { randomInt } from "crypto";
import dotenv from "dotenv";
dotenv.config();

export function generateOtp(len = 6) {
  // returns 6-digit string, padded
  const max = 10 ** len;
  const num = randomInt(0, max);
  return String(num).padStart(len, "0");
}

export function otpExpiryDate() {
  const ttl = Number(process.env.OTP_TTL_MINUTES || 10);
  const d = new Date();
  d.setMinutes(d.getMinutes() + ttl);
  return d;
}
