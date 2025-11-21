import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

export async function authGuard(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'missing_token' });
  const parts = header.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'invalid_token_format' });
  try {
    const payload = verifyAccessToken(parts[1] as string) as any;
    (req as any).user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'invalid_token' });
  }
}
