import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UserRole } from '@prisma/client';

export const checkRole = (roles: Array<UserRole>) => {
  
  return (req: AuthRequest, res: Response, next: NextFunction) => {
  
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const hasRole = roles.includes(req.user.role as UserRole);
    
    if (!hasRole) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to perform this action.' });
    }
    console.log("Roles: ", roles, "User Role:", req.user.role);

    next();
  };
};