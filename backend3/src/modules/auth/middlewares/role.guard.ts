import { Request, Response, NextFunction } from 'express';

export function roleGuard(allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'not_authenticated' });
    if (!allowed.includes(user.role)) return res.status(403).json({ message: 'forbidden' });
    next();
  };
}
