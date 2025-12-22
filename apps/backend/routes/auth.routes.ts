import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { comparePassword } from '../services/password.service';
import { hashPassword } from '../services/password.service';
import { hashToken, generateToken } from '../src/utils/token.util';
import rateLimit from 'express-rate-limit';
import { AuthRequest, protect } from '../middleware/auth.middleware';
import { AuditService } from '../src/services/audit.service';

const router = Router();
const prisma = new PrismaClient();

// Rate limiter for public endpoints (onboarding, login attempts)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: Generate both access and refresh tokens
function generateTokens(userId: string, tenantId: string | null, role: string, name: string | null) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const accessToken = jwt.sign(
    { userId, tenantId, role, name },
    jwtSecret,
    { expiresIn: '1h' } // Short-lived access token
  );

  // Refresh token: longer expiry, will be hashed and stored in DB
  const refreshTokenPayload = jwt.sign(
    { userId, type: 'refresh' },
    jwtSecret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshTokenPayload };
}

// POST /api/auth/login
router.post('/login', publicLimiter, async (req: any, res: any) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent');

  const user = await prisma.user.findUnique({ where: { email } });

  // Log failed login attempts
  if (!user || !(await comparePassword(password, user.password))) {
    // Log failed attempt if user exists
    if (user) {
      await AuditService.logLogin({
        userId: user.id,
        tenantId: user.tenantId || undefined,
        success: false,
        reason: 'INVALID_CREDENTIALS',
        ip,
        userAgent,
      });
    }
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // Check account active status
  if (!user.isActive) {
    await AuditService.logLogin({
      userId: user.id,
      tenantId: user.tenantId || undefined,
      success: false,
      reason: 'ACCOUNT_INACTIVE',
      ip,
      userAgent,
    });
    return res.status(403).json({ error: 'Account is inactive.' });
  }

  // Check account lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await AuditService.logLogin({
      userId: user.id,
      tenantId: user.tenantId || undefined,
      success: false,
      reason: 'ACCOUNT_LOCKED',
      ip,
      userAgent,
    });
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return res.status(403).json({ error: `Account locked. Try again in ${minutesLeft} minutes.` });
  }

  try {
    const { accessToken, refreshTokenPayload } = generateTokens(
      user.id,
      user.tenantId,
      user.role,
      user.name
    );

    // Extract expiry from refresh token JWT
    const decoded = jwt.decode(refreshTokenPayload) as any;
    const expiresAt = new Date(decoded.exp * 1000);

    // Hash and store refresh token
    const { hashed: hashedRefreshToken } = generateToken();
    // Actually use the refreshTokenPayload hash as the stored token
    const refreshTokenHash = hashToken(refreshTokenPayload);

    // Clean up old revoked tokens and store new refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
        ip,
        userAgent,
      },
    });

    // Reset failed attempts and lockout on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Log successful login
    await AuditService.logLogin({
      userId: user.id,
      tenantId: user.tenantId || undefined,
      success: true,
      ip,
      userAgent,
    });

    res.json({
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken: refreshTokenPayload,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          name: user.name,
        },
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in.' });
  }
});

// POST /api/auth/refresh - Exchange refresh token for new access token (with rotation)
router.post('/refresh', async (req: any, res: any) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    // Verify refresh token signature
    const decoded = jwt.verify(refreshToken, jwtSecret) as any;

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type.' });
    }

    const userId = decoded.userId;

    // Check if refresh token exists and is not revoked
    const refreshTokenHash = hashToken(refreshToken);
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        userId,
        tokenHash: refreshTokenHash,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedToken) {
      return res.status(401).json({ error: 'Invalid or revoked refresh token.' });
    }

    // Fetch user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Generate new tokens (rotation)
    const { accessToken, refreshTokenPayload: newRefreshToken } = generateTokens(
      user.id,
      user.tenantId,
      user.role,
      user.name
    );

    // Extract expiry from new refresh token
    const newDecoded = jwt.decode(newRefreshToken) as any;
    const newExpiresAt = new Date(newDecoded.exp * 1000);

    // Mark old token as revoked and create new one (atomic via transaction)
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked: true },
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(newRefreshToken),
          expiresAt: newExpiresAt,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        },
      }),
    ]);

    res.json({
      message: 'Token refreshed successfully',
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token.' });
  }
});

// POST /api/auth/unlock-account - Admin endpoint to unlock a locked user account
// Note: User accounts auto-unlock after 15 minutes, this is for immediate admin intervention
router.post('/unlock-account', protect, async (req: AuthRequest, res: any) => {
  const { userId } = req.body;

  // Only OWNER and MANAGER can unlock
  if (req.user!.role !== 'OWNER' && req.user!.role !== 'MANAGER') {
    return res.status(403).json({
      error: 'Only managers and owners can unlock accounts.'
    });
  }

  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Unlock account
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    res.json({
      message: `Account for ${user.email} has been unlocked.`,
      user: { id: user.id, email: user.email }
    });
  } catch (error: any) {
    console.error('Unlock account error:', error);
    res.status(500).json({ error: 'Failed to unlock account.' });
  }
});

// POST /api/auth/logout - Revoke refresh token
router.post('/logout', protect, async (req: AuthRequest, res: any) => {
  const { refreshToken } = req.body;

  try {
    const userId = req.user!.userId;

    if (refreshToken) {
      // Revoke the specific refresh token
      const tokenHash = hashToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: {
          userId,
          tokenHash,
          revoked: false,
        },
        data: { revoked: true },
      });
    } else {
      // Revoke all non-expired refresh tokens for this user (logout from all devices)
      await prisma.refreshToken.updateMany({
        where: {
          userId,
          revoked: false,
          expiresAt: { gt: new Date() },
        },
        data: { revoked: true },
      });
    }

    res.json({ message: 'Logged out successfully.' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to log out.' });
  }
});

// POST /api/auth/unlock-account - Admin endpoint to unlock a locked user account
// Note: User accounts auto-unlock after 15 minutes, this is for immediate admin intervention
router.post('/unlock-account', protect, async (req: AuthRequest, res: any) => {
  const { userId } = req.body;

  // Only OWNER and MANAGER can unlock
  if (req.user!.role !== 'OWNER' && req.user!.role !== 'MANAGER') {
    return res.status(403).json({
      error: 'Only managers and owners can unlock accounts.'
    });
  }

  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Unlock account
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    res.json({
      message: `Account for ${user.email} has been unlocked.`,
      user: { id: user.id, email: user.email }
    });
  } catch (error: any) {
    console.error('Unlock account error:', error);
    res.status(500).json({ error: 'Failed to unlock account.' });
  }
});

// POST /api/auth/forgot-password - Initiate password reset (rate-limited)
router.post('/forgot-password', publicLimiter, async (req: any, res: any) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // For security, don't reveal if user exists
      return res.json({ message: 'If an account with this email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const { token: resetToken, hashed: hashedResetToken } = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Create password reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashedResetToken,
        expiresAt,
      },
    });

    // In production, send email with reset link
    const resetLink = `${process.env.BASE_URL}/api/auth/reset-password?token=${resetToken}`;
    console.log(`--DEV ONLY-- Password reset link for ${email}: ${resetLink}`);

    res.json({
      message: 'If an account with this email exists, a password reset link has been sent.',
      resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to initiate password reset.' });
  }
});

// GET /api/auth/verify-reset-token/:token - Verify reset token is valid
router.get('/verify-reset-token/:token', async (req: any, res: any) => {
  const { token } = req.params;

  try {
    const hashedToken = hashToken(token);

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: hashedToken,
        used: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        user: {
          select: { id: true, email: true }
        }
      }
    });

    if (!resetToken) {
      return res.status(400).json({
        error: 'Invalid or expired password reset token.'
      });
    }

    res.json({
      message: 'Reset token is valid.',
      user: { email: resetToken.user.email }
    });
  } catch (error: any) {
    console.error('Verify reset token error:', error);
    res.status(500).json({
      error: 'Failed to verify reset token.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/auth/reset-password - Complete password reset
router.post('/reset-password', async (req: any, res: any) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    return res.status(400).json({
      error: 'Token, password, and password confirmation are required.'
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      error: 'Passwords do not match.'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long.'
    });
  }

  try {
    const hashedToken = hashToken(token);

    // Find and validate reset token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: hashedToken,
        used: false,
        expiresAt: { gt: new Date() },
      }
    });

    if (!resetToken) {
      return res.status(400).json({
        error: 'Invalid or expired password reset token.'
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update password and mark token as used (atomic transaction)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      // Revoke all refresh tokens to force re-login
      prisma.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revoked: false,
        },
        data: { revoked: true },
      }),
    ]);

    res.json({
      message: 'Password reset successful. Please log in with your new password.'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Failed to reset password.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/auth/onboard - Public onboarding endpoint (rate-limited)
router.post('/onboard', publicLimiter, async (req: any, res: any) => {
  const { email, password, tenantName, phoneNumber, ownerName } = req.body;

  // Validation
  if (!email || !password || !tenantName || !phoneNumber) {
    return res.status(400).json({
      error: 'Email, password, tenant name, and phone number are required.'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long.'
    });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: 'Invalid email format.'
    });
  }

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email already exists.'
      });
    }

    // Generate email verification token
    const { token: verificationToken, hashed: hashedVerificationToken } = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Hash password for storage
    const hashedPassword = await hashPassword(password);

    // Create tenant + owner user in a single transaction
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        phoneNumber,
        users: {
          create: {
            email,
            password: hashedPassword,
            name: ownerName || email.split('@')[0],
            phoneNumber,
            role: UserRole.OWNER,
            // Email verification fields (using setupToken for verification)
            setupToken: hashedVerificationToken,
            setupTokenExpires: verificationExpires,
          }
        }
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        users: {
          select: { id: true, email: true, role: true }
        }
      }
    });

    // In production, send email with verification link
    const verificationLink = `${process.env.BASE_URL}/api/auth/verify-email?token=${verificationToken}`;
    console.log(`--DEV ONLY-- Email verification link for ${email}: ${verificationLink}`);

    res.status(201).json({
      message: 'Onboarding successful. Please verify your email to activate your account.',
      tenant,
      verificationLink: process.env.NODE_ENV === 'development' ? verificationLink : undefined
    });

  } catch (error: any) {
    console.error('Onboarding error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    res.status(500).json({
      error: 'Failed to complete onboarding.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/auth/verify-email/:token - Verify email address (public endpoint)
router.get('/verify-email/:token', async (req: any, res: any) => {
  const { token } = req.params;

  try {
    const hashedToken = hashToken(token);

    const user = await prisma.user.findFirst({
      where: {
        setupToken: hashedToken,
        setupTokenExpires: {
          gt: new Date() // Token hasn't expired
        }
      },
      select: {
        id: true,
        email: true,
        tenantId: true
      }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired verification token.'
      });
    }

    // Mark email as verified (clear setup token)
    // In the future, you may add an isEmailVerified boolean field
    await prisma.user.update({
      where: { id: user.id },
      data: {
        setupToken: null,
        setupTokenExpires: null
      }
    });

    res.json({
      message: 'Email verified successfully. You can now log in.',
      user: { email: user.email, tenantId: user.tenantId }
    });

  } catch (error: any) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Failed to verify email.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/auth/setup-account - This is a public route
router.post('/setup-account', async (req: any, res: any) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required.' });
  }

  // Hash the token provided by the user to find it in the database
  const incomingHash = hashToken(token)
  console.log('Setup account with token (hashed):', incomingHash);

  const user = await prisma.user.findFirst({
    where: { setupToken: incomingHash },
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

// GET /api/auth/setup-account/:token - Verify setup token. This is a public route
router.get('/setup-account/:token', async (req: any, res: any) => {
  const { token } = req.params;

  try {

    const incomingHash = hashToken(token)

    const user = await prisma.user.findFirst({
      where: {
        setupToken: incomingHash,
        setupTokenExpires: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    if (!user) {
      res.status(400).json({
        error: 'Invalid or expired setup token.'
      });
      return;
    }

    res.json({
      message: 'Token is valid.',
      user
    });

  } catch (error: any) {
    console.error('Verify token error:', error);
    res.status(500).json({
      error: 'Failed to verify token.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/auth/login-history - Get login history for current user
router.get('/login-history', protect, async (req: any, res: any) => {
  try {
    const userId = (req as AuthRequest).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const history = await AuditService.getUserLoginHistory(userId, limit);

    res.json({
      message: 'Login history retrieved',
      data: history,
    });
  } catch (error: any) {
    console.error('Error retrieving login history:', error);
    res.status(500).json({ error: 'Failed to retrieve login history.' });
  }
});

// GET /api/auth/tenant/login-history - Get login history for tenant (OWNER/MANAGER only)
router.get('/tenant/login-history', protect, async (req: any, res: any) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.tenantId || !['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const history = await AuditService.getTenantLoginHistory(user.tenantId, limit);

    res.json({
      message: 'Tenant login history retrieved',
      data: history,
    });
  } catch (error: any) {
    console.error('Error retrieving tenant login history:', error);
    res.status(500).json({ error: 'Failed to retrieve tenant login history.' });
  }
});

// GET /api/auth/tenant/audit-logs - Get audit logs for tenant (OWNER/MANAGER only)
router.get('/tenant/audit-logs', protect, async (req: any, res: any) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.tenantId || !['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const action = req.query.action as string | undefined;
    const logs = await AuditService.getTenantAuditLogs(user.tenantId, limit, action);

    res.json({
      message: 'Tenant audit logs retrieved',
      data: logs,
    });
  } catch (error: any) {
    console.error('Error retrieving audit logs:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

// GET /api/auth/tenant/suspicious-activity - Get suspicious activity for tenant
router.get('/tenant/suspicious-activity', protect, async (req: any, res: any) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.tenantId || !['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const minutes = Math.min(parseInt(req.query.minutes) || 30, 1440);
    const activity = await AuditService.getSuspiciousActivity(user.tenantId, minutes);

    res.json({
      message: 'Suspicious activity retrieved',
      data: activity,
    });
  } catch (error: any) {
    console.error('Error retrieving suspicious activity:', error);
    res.status(500).json({ error: 'Failed to retrieve suspicious activity.' });
  }
});

export default router;