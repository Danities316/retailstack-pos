import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { comparePassword } from '../services/password.service';
import crypto from 'crypto';
import { hashPassword } from '../services/password.service';


const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/login
router.post('/login', async (req: any, res: any) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await comparePassword(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // Ensure the JWT_SECRET is loaded
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET not found in environment variables.');
    return res.status(500).json({ error: 'Internal server error: JWT secret is not configured.' });
  }

  const token = jwt.sign(
    { userId: user.id, tenantId: user.tenantId, role: user.role },
    jwtSecret,
    { expiresIn: '1d' }
  );

  res.json({ 
    message: 'Login successful',
    token, 
    user: { 
      id: user.id, 
      email: user.email, 
      role: user.role, 
      tenantId: user.tenantId 
    } 
  });
});

// POST /api/auth/setup-account - This is a public route
router.post('/setup-account', async (req: any, res: any) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required.' });
  }

  // Hash the token provided by the user to find it in the database
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findUnique({
    where: { setupToken: hashedToken },
  });

  if (!user || !user.setupTokenExpires || user.setupTokenExpires < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired setup token.' });
  }

  const newHashedPassword = await hashPassword(password);

  // Update user with new password and clear the token fields
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: newHashedPassword,
      setupToken: null,
      setupTokenExpires: null,
    },
  });

  res.json({ message: 'Account setup successful. You can now log in.' });
});

export default router;