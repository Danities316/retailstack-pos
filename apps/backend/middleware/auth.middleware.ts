import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { userId: string; tenantId: string; role: string; };
}

<<<<<<< HEAD
export const protect = (req: AuthRequest, res: Response, next: NextFunction): void => {
=======
export const protect = (req: AuthRequest, res: Response, next: NextFunction) => {
>>>>>>> f3fdb7e (Initial commit)
  const bearer = req.headers.authorization;
  

  if (!bearer || !bearer.startsWith('Bearer ')) {
<<<<<<< HEAD
    res.status(401).json({ error: 'Unauthorized: No token provided.' });
    return;
=======
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
>>>>>>> f3fdb7e (Initial commit)
  }

  const [, token] = bearer.split(' ');

  if (!token) {
<<<<<<< HEAD
    res.status(401).json({ error: 'Unauthorized: Invalid token format.' });
    return;
=======
    return res.status(401).json({ error: 'Unauthorized: Invalid token format.' });
>>>>>>> f3fdb7e (Initial commit)
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = payload;
    next();
  } catch (error) {
<<<<<<< HEAD
    res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    return;
=======
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
>>>>>>> f3fdb7e (Initial commit)
  }
};