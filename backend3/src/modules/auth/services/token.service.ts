import { pool } from '../../../db';
import { signRefreshToken } from '../utils/jwt';

export async function createRefreshToken(userId: string, userType: 'retailer'|'distributor', fingerprint?: string) {
  const { token, expiresAt } = signRefreshToken({ userId, userType });
  const res = await pool.query(
    `INSERT INTO auth.refresh_tokens (user_id, user_type, token, fingerprint, expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, userType, token, fingerprint || null, expiresAt]
  );
  return res.rows[0];
}

export async function revokeRefreshTokenById(id: string) {
  await pool.query(`UPDATE auth.refresh_tokens SET revoked = true WHERE id = $1`, [id]);
}

export async function revokeRefreshToken(token: string) {
  await pool.query(`UPDATE auth.refresh_tokens SET revoked = true WHERE token = $1`, [token]);
}

export async function findRefreshToken(token: string) {
  const res = await pool.query(`SELECT * FROM auth.refresh_tokens WHERE token = $1 AND revoked = false LIMIT 1`, [token]);
  return res.rows[0];
}
