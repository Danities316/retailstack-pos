import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UserRole } from '@prisma/client';

export const checkRole = (roles: Array<UserRole>) => {
  
<<<<<<< HEAD
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
  
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
=======
  return (req: AuthRequest, res: Response, next: NextFunction) => {
  
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
>>>>>>> f3fdb7e (Initial commit)
    }
    
    const hasRole = roles.includes(req.user.role as UserRole);
    
    if (!hasRole) {
<<<<<<< HEAD
      res.status(403).json({ error: 'Forbidden: You do not have permission to perform this action.' });
      return;
=======
      return res.status(403).json({ error: 'Forbidden: You do not have permission to perform this action.' });
>>>>>>> f3fdb7e (Initial commit)
    }
    console.log("Roles: ", roles, "User Role:", req.user.role);

    next();
  };
};