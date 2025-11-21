import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-change-me';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const REFRESH_EXPIRY_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS || 30);

export function signAccessToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, JWT_SECRET);
}

export function signRefreshToken(payload: object) {
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const token = jwt.sign({ ...payload, exp: Math.floor(expiresAt.getTime() / 1000) }, JWT_SECRET);
  return { token, expiresAt };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, JWT_SECRET);
}
