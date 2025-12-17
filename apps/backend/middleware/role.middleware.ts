import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UserRole } from '@prisma/client';

export const checkRole = (roles: Array<UserRole>) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const hasRole = roles.includes(req.user.role as UserRole);

    if (!hasRole) {
      res.status(403).json({ error: 'Forbidden: You do not have permission to perform this action.' });
      return;
    }
    console.log("Roles: ", roles, "User Role:", req.user.role);

    next();
  };
};