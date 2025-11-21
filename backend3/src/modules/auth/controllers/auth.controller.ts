import { Request, Response } from 'express';
import * as AuthService from '../services/auth.service';
import { registerRetailerSchema, registerDistributorSchema, loginSchema, requestOtpSchema, verifyOtpSchema, resetPasswordSchema } from '../schemas/auth.schemas';

export async function registerRetailerHandler(req: Request, res: Response) {
  const parsed = registerRetailerSchema.parse(req.body);
  const user = await AuthService.registerRetailer(parsed);
  res.json({ message: 'registered', data: { id: user.id, email: user.email } });
}

export async function registerDistributorHandler(req: Request, res: Response) {
  const parsed = registerDistributorSchema.parse(req.body);
  const user = await AuthService.registerDistributor(parsed);
  res.json({ message: 'registered', data: { id: user.id, email: user.email } });
}

export async function loginRetailerHandler(req: Request, res: Response) {
  const parsed = loginSchema.parse(req.body);
  const out = await AuthService.loginRetailer(parsed.email, parsed.password);
  res.json({ message: 'ok', ...out });
}

export async function loginDistributorHandler(req: Request, res: Response) {
  const parsed = loginSchema.parse(req.body);
  const out = await AuthService.loginDistributor(parsed.email, parsed.password);
  res.json({ message: 'ok', ...out });
}

export async function sendOtpHandler(req: Request, res: Response) {
  const { email } = requestOtpSchema.parse(req.body);
  await AuthService.sendOtp(email);
  res.json({ message: 'otp_sent' });
}

export async function verifyOtpHandler(req: Request, res: Response) {
  const { email, otp } = verifyOtpSchema.parse(req.body);
  const ok = await AuthService.verifyOtp(email, otp);
  if (!ok) return res.status(400).json({ message: 'invalid_otp' });
  res.json({ message: 'verified' });
}

export async function resetPasswordHandler(req: Request, res: Response) {
  const { email, otp, newPassword } = resetPasswordSchema.parse(req.body);
  const ok = await AuthService.verifyOtp(email, otp);
  if (!ok) return res.status(400).json({ message: 'invalid_otp' });
  const r = await AuthService.resetRetailerPassword(email, newPassword).catch(() => false);
  const d = await AuthService.resetDistributorPassword(email, newPassword).catch(() => false);
  if (!r && !d) return res.status(404).json({ message: 'user_not_found' });
  res.json({ message: 'password_reset' });
}
