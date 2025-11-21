import bcrypt from 'bcrypt';
import { pool } from '../../../db';
import { signAccessToken } from '../utils/jwt';
import * as TokenService from './token.service';
import { sendOtpEmail } from '../utils/email';

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

export async function registerRetailer(payload: any) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hashed = await bcrypt.hash(payload.password, SALT_ROUNDS);
    const res = await client.query(
      `INSERT INTO auth.retailers (business_name, owner_name, email, password, phone, gst_number, business_type, pincode, location, address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [payload.businessName, payload.ownerName, payload.email.toLowerCase(), hashed, payload.phone, payload.gstNumber || null, payload.businessType || null, payload.pincode || null, payload.location ? JSON.stringify(payload.location) : null, payload.address || null]
    );
    const user = res.rows[0];
    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

export async function registerDistributor(payload: any) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hashed = await bcrypt.hash(payload.password, SALT_ROUNDS);
    const res = await client.query(
      `INSERT INTO auth.distributors (company_name, owner_name, email, password, phone, gst_number, business_type, pincode, location, address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [payload.companyName || payload.businessName, payload.ownerName, payload.email.toLowerCase(), hashed, payload.phone, payload.gstNumber || null, payload.businessType || null, payload.pincode || null, payload.location ? JSON.stringify(payload.location) : null, payload.address || null]
    );
    const user = res.rows[0];
    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

export async function loginRetailer(email: string, password: string) {
  const res = await pool.query('SELECT * FROM auth.retailers WHERE email = $1', [email.toLowerCase()]);
  const user = res.rows[0];
  if (!user) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('Invalid credentials');
  const accessToken = signAccessToken({ userId: user.id, role: 'retailer', email: user.email });
  const refresh = await TokenService.createRefreshToken(user.id, 'retailer');
  return { accessToken, refreshToken: refresh.token, user: { id: user.id, business_name: user.business_name, owner_name: user.owner_name, email: user.email } };
}

export async function loginDistributor(email: string, password: string) {
  const res = await pool.query('SELECT * FROM auth.distributors WHERE email = $1', [email.toLowerCase()]);
  const user = res.rows[0];
  if (!user) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('Invalid credentials');
  const accessToken = signAccessToken({ userId: user.id, role: 'distributor', email: user.email });
  const refresh = await TokenService.createRefreshToken(user.id, 'distributor');
  return { accessToken, refreshToken: refresh.token, user: { id: user.id, company_name: user.company_name, owner_name: user.owner_name, email: user.email } };
}

// OTP flows
export async function sendOtp(email: string) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await pool.query(`INSERT INTO auth.otps (email, otp, expires_at) VALUES ($1,$2, now() + interval '10 minutes')`, [email.toLowerCase(), otp]);
  await sendOtpEmail(email, otp);
  return true;
}

export async function verifyOtp(email: string, otp: string) {
  const res = await pool.query(`SELECT * FROM auth.otps WHERE email = $1 AND otp = $2 AND expires_at > now() ORDER BY created_at DESC LIMIT 1`, [email.toLowerCase(), otp]);
  if (res.rowCount === 0) return false;
  await pool.query(`DELETE FROM auth.otps WHERE email = $1`, [email.toLowerCase()]);
  return true;
}

export async function resetRetailerPassword(email: string, newPassword: string) {
  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const r = await pool.query(`UPDATE auth.retailers SET password = $1 WHERE email = $2 RETURNING id`, [hashed, email.toLowerCase()]);
  return r.rowCount > 0;
}

export async function resetDistributorPassword(email: string, newPassword: string) {
  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const r = await pool.query(`UPDATE auth.distributors SET password = $1 WHERE email = $2 RETURNING id`, [hashed, email.toLowerCase()]);
  return r.rowCount > 0;
}
