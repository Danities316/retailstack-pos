import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { comparePassword } from '../services/password.service';
import { hashPassword } from '../services/password.service';
import { hashToken, generateToken, generateNumericOtp } from '../src/utils/token.util';
import rateLimit from 'express-rate-limit';
import { AuthRequest, protect } from '../middleware/auth.middleware';
import { AuditService } from '../src/services/audit.service';
import { NotificationService } from '../src/services/notification.service';

const router = Router();
const prisma = new PrismaClient();

// ============================================================================
// SECURITY CONSTANTS (MVP Configuration)
// ============================================================================
const AUTH_CONFIG = {
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,      // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 5,                 // 5 requests per window

  // Token expiry
  ACCESS_TOKEN_EXPIRY: '1h',                  // Short-lived
  REFRESH_TOKEN_EXPIRY: '7d',                 // Longer-lived
  RESET_TOKEN_EXPIRY_MS: 60 * 60 * 1000,     // 1 hour
  VERIFICATION_TOKEN_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
  OTP_EXPIRY_MS: 10 * 60 * 1000,             // 10 minutes

  // Security thresholds
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,       // 15 minutes

  // Validation
  MIN_PASSWORD_LENGTH: 8,
  OTP_LENGTH: 6,
};

// Rate limiter for public endpoints (onboarding, login attempts)
const publicLimiter = rateLimit({
  windowMs: AUTH_CONFIG.RATE_LIMIT_WINDOW_MS,
  max: AUTH_CONFIG.RATE_LIMIT_MAX_REQUESTS,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: AuthRequest, res: any) => {
    res.status(429).json({
      error: 'Too many login attempts. Please wait a few minutes and try again.',
    });
  },
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
  const { email, phoneNumber, password } = req.body;
  const identifier = email?.trim() || phoneNumber?.trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Phone number (or email) and password are required.' });
  }


  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent');

  const user = await prisma.user.findFirst({
    where: phoneNumber
      ? { phoneNumber: phoneNumber.trim() }
      : { email: email.trim() },
  });
  console.log(`Login attempt for ${phoneNumber ? 'phone' : 'email'}: ${identifier} — user found:`, !!user);

  // Log failed login attempts
  if (!user || !(await comparePassword(password, user.password))) {
    // Log failed attempt if user exists
    if (user) {
      // Increment failed login attempts and lock account if threshold reached
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const isLocked = newFailedAttempts >= AUTH_CONFIG.MAX_FAILED_LOGIN_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          ...(isLocked && {
            lockedUntil: new Date(Date.now() + AUTH_CONFIG.LOCKOUT_DURATION_MS)
          })
        }
      });

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

  // Check phone verification — OWNER accounts must verify their phone before
  // they can log in. Cashiers and Managers are invited via setup link and are
  // considered verified on first login.
  if (user.role === 'OWNER' && !user.phoneVerified) {
    await AuditService.logLogin({
      userId: user.id,
      tenantId: user.tenantId || undefined,
      success: false,
      reason: 'PHONE_NOT_VERIFIED',
      ip,
      userAgent,
    });

    return res.status(403).json({
      error: 'Please verify your phone number before logging in.',
      code: 'PHONE_NOT_VERIFIED',
      userId: user.id,
      phoneNumber: user.phoneNumber,
    });
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

    // Capture isFirstLogin before clearing it
    const isFirstLogin = user.isFirstLogin;

    // Reset failed attempts, lockout, lastLoginAt, and clear isFirstLogin on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        isFirstLogin: false, // Cleared permanently after first successful login
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

    // Fetch tenant onboarding state (only if user belongs to a tenant)
    let onboarding = null;
    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          hasProduct: true,
          hasSale: true,
          hasInvitedUser: true,
          onboardingCompletedAt: true,
        },
      });

      if (tenant) {
        // "completed" is derived — not stored — per spec
        const completed = tenant.hasProduct && tenant.hasSale;
        onboarding = {
          hasProduct: tenant.hasProduct,
          hasSale: tenant.hasSale,
          hasInvitedUser: tenant.hasInvitedUser,
          completed,
        };
      }
    }

    res.json({
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken: refreshTokenPayload,
        user: {
          ...user,
          isFirstLogin, // true only on their very first login ever
        },
        onboarding, // null for SUPER_ADMIN (no tenant); object for all others
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
    const expiresAt = new Date(Date.now() + AUTH_CONFIG.RESET_TOKEN_EXPIRY_MS); // 1 hour

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

    // Send password reset email asynchronously (don't block response)
    NotificationService.sendPasswordResetEmail(
      email,
      user.name || email.split('@')[0],
      resetLink
    ).catch(err => {
      console.warn(`Failed to send password reset email to ${email}: ${err}`);
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to initiate password reset.' });
  }
});

// GET /api/auth/verify-reset-token/:token - Verify reset token is valid
// router.get('/verify-reset-token/:token', async (req: any, res: any) => {
//   const { token } = req.params;

//   try {
//     const hashedToken = hashToken(token);

//     const resetToken = await prisma.passwordResetToken.findFirst({
//       where: {
//         tokenHash: hashedToken,
//         used: false,
//         expiresAt: { gt: new Date() },
//       },
//       select: {
//         id: true,
//         user: {
//           select: { id: true, email: true }
//         }
//       }
//     });

//     if (!resetToken) {
//       return res.status(400).json({
//         error: 'Invalid or expired password reset token.'
//       });
//     }

//     res.json({
//       message: 'Reset token is valid.',
//       user: { email: resetToken.user.email }
//     });
//   } catch (error: any) {
//     console.error('Verify reset token error:', error);
//     res.status(500).json({
//       error: 'Failed to verify reset token.',
//       message: error instanceof Error ? error.message : String(error)
//     });
//   }
// });

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

  if (password.length < AUTH_CONFIG.MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: `Password must be at least ${AUTH_CONFIG.MIN_PASSWORD_LENGTH} characters long.`
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

    // Send password reset confirmation email asynchronously
    const user = await prisma.user.findUnique({
      where: { id: resetToken.userId },
      select: { email: true, name: true }
    });
    if (user) {
      NotificationService.sendPasswordResetConfirmation(
        user.email,
        user.name || user.email.split('@')[0],
        `${process.env.BASE_URL || 'https://retailstack.com'}/login`
      ).catch(err => {
        console.warn(`Failed to send password reset confirmation to ${user.email}: ${err}`);
      });
    }
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Failed to reset password.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// SMS OTP PASSWORD RESET ROUTES
// Add these two routes to apps/backend/routes/auth.routes.ts
// Paste them right after the existing POST /reset-password route (~line 580)
// ============================================================================

// POST /api/auth/forgot-password-sms
// Initiates password reset via SMS OTP. Rate-limited.
router.post('/forgot-password-sms', publicLimiter, async (req: any, res: any) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  // Normalise: strip spaces, ensure it starts with +234 or 0
  const normalised = phoneNumber.trim();

  try {
    // Find user by phone number
    const user = await prisma.user.findFirst({
      where: { phoneNumber: normalised },
      select: { id: true, phoneNumber: true, name: true, isActive: true },
    });

    // Always return 200 — never reveal whether the number exists
    if (!user || !user.isActive) {
      return res.json({
        message: 'If an account exists with that number, an OTP has been sent.',
      });
    }

    // Invalidate any existing unused OTPs for this user to prevent accumulation
    await prisma.otpToken.updateMany({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: { used: true },
    });

    // Generate a fresh 6-digit OTP
    const { code, hashed } = generateNumericOtp(AUTH_CONFIG.OTP_LENGTH);
    const expiresAt = new Date(Date.now() + AUTH_CONFIG.OTP_EXPIRY_MS); // 10 minutes

    await prisma.otpToken.create({
      data: {
        userId: user.id,
        phoneNumber: normalised,
        codeHash: hashed,
        expiresAt,
      },
    });

    // Send OTP via KudiSMS
    const smsResult = await NotificationService.sendPasswordResetOTPSMS(normalised, code);
    if (!smsResult.success) {
      console.error(`[SMS Reset] Failed to send OTP to ${normalised}: ${smsResult.error}`);
      // Still return 200 — don't expose internal errors. OTP is saved, user can retry.
    }

    console.log(`[SMS Reset] OTP generated for user ${user.id} — SMS ${smsResult.success ? 'sent' : 'FAILED'}`);

    return res.json({
      message: 'If an account exists with that number, an OTP has been sent.',
      userId: user.id, // Needed by the frontend for the verify step
    });
  } catch (error: any) {
    console.error('[SMS Reset] forgot-password-sms error:', error);
    return res.status(500).json({ error: 'Failed to initiate password reset.' });
  }
});


// POST /api/auth/reset-password-otp
// Verifies the OTP and sets a new password.
router.post('/reset-password-otp', async (req: any, res: any) => {
  const { userId, otp, newPassword, confirmPassword } = req.body;

  if (!userId || !otp || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'userId, otp, newPassword, and confirmPassword are required.' });
  }

  if (newPassword.length < AUTH_CONFIG.MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: `Password must be at least ${AUTH_CONFIG.MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  try {
    const codeHash = hashToken(String(otp).trim());

    // Find a valid, unused OTP for this user
    const otpRecord = await prisma.otpToken.findFirst({
      where: {
        userId,
        codeHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      // Increment attempts to deter brute force (best-effort — no hard lockout at MVP)
      console.warn(`[SMS Reset] Invalid or expired OTP attempt for userId ${userId}`);
      return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new code.' });
    }

    // Mark OTP as used immediately to prevent replay
    await prisma.otpToken.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // Hash and save the new password
    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        failedLoginAttempts: 0, // Clear any lockout
        lockedUntil: null,
      },
    });

    // Invalidate all refresh tokens so existing sessions must re-authenticate
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });

    console.log(`[SMS Reset] Password successfully reset for userId ${userId}`);

    return res.json({ message: 'Password reset successful. Please log in with your new password.' });
  } catch (error: any) {
    console.error('[SMS Reset] reset-password-otp error:', error);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// ============================================================================
// POST /api/auth/resend-otp
// Resends a fresh OTP to the user's phone. Used by VerifyPhonePage resend button.
// Paste this into apps/backend/routes/auth.routes.ts after the /verify-otp route.
// ============================================================================

router.post('/resend-otp', publicLimiter, async (req: any, res: any) => {
  const { userId, phoneNumber } = req.body;

  if (!userId || !phoneNumber) {
    return res.status(400).json({ error: 'userId and phoneNumber are required.' });
  }

  try {
    // Confirm the user exists and is not yet phone-verified
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phoneVerified: true, isActive: true },
    });

    if (!user) {
      // Return 200 to avoid user enumeration
      return res.json({ message: 'If that account exists, a new code has been sent.' });
    }

    if (user.phoneVerified) {
      return res.status(400).json({ error: 'This phone number is already verified.' });
    }

    // Invalidate any existing unused OTPs for this user
    await prisma.otpToken.updateMany({
      where: { userId, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });

    // Generate and save a fresh OTP
    const { code, hashed } = generateNumericOtp(AUTH_CONFIG.OTP_LENGTH);
    const expiresAt = new Date(Date.now() + AUTH_CONFIG.OTP_EXPIRY_MS);

    await prisma.otpToken.create({
      data: { userId, phoneNumber, codeHash: hashed, expiresAt },
    });

    const smsResult = await NotificationService.sendOnboardingSMS(phoneNumber, Number(code));
    if (!smsResult.success) {
      console.error(`[ResendOTP] SMS failed for userId ${userId}: ${smsResult.error}`);
    }

    return res.json({ message: 'If that account exists, a new code has been sent.' });
  } catch (error: any) {
    console.error('[ResendOTP] Error:', error);
    return res.status(500).json({ error: 'Failed to resend OTP.' });
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

  if (password.length < AUTH_CONFIG.MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: `Password must be at least ${AUTH_CONFIG.MIN_PASSWORD_LENGTH} characters long.`
    });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: 'Invalid email format.'
    });
  }

  try {
    // Check if phone already exists
    const existingUser = await prisma.user.findUnique({ where: { phoneNumber } });
    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this phone number already exists.'
      });
    }

    // Generate email verification token
    const { token: verificationToken, hashed: hashedVerificationToken } = generateToken();
    const verificationExpires = new Date(Date.now() + AUTH_CONFIG.VERIFICATION_TOKEN_EXPIRY_MS); // 24 hours

    console.log(`[ONBOARD] Email: ${email}`);
    console.log(`[ONBOARD] Generated token (first 8 chars): ${verificationToken.substring(0, 8)}...`);
    console.log(`[ONBOARD] Hashed token (first 8 chars): ${hashedVerificationToken.substring(0, 8)}...`);
    console.log(`[ONBOARD] Expires at: ${verificationExpires.toISOString()} (${verificationExpires.getTime()})`);
    console.log(`[ONBOARD] Current time: ${new Date().toISOString()} (${Date.now()})`);

    // Hash password for storage
    const hashedPassword = await hashPassword(password);

    // Create tenant + owner user in a single transaction
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        phoneNumber,
        // New tenants start with all onboarding flags false (schema defaults)
        // hasProduct: false, hasSale: false, hasInvitedUser: false (all default false)
        // onboardingCompletedAt: null (schema default)
        users: {
          create: {
            email,
            password: hashedPassword,
            name: ownerName || email.split('@')[0],
            phoneNumber,
            role: UserRole.OWNER,
            isFirstLogin: true, // Explicitly set — owner has never logged in
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

    // Verify token was stored correctly
    const createdUser = await prisma.user.findUnique({
      where: { phoneNumber },
      select: { setupToken: true, setupTokenExpires: true }
    });

    console.log(`[ONBOARD] Token stored in DBsssss: ${createdUser?.setupToken}`);
    console.log(`[ONBOARD] Token stored in DB: ${createdUser?.setupToken ? 'YES' : 'NO'}`);
    if (createdUser?.setupToken) {
      console.log(`[ONBOARD] Stored token (first 8 chars): ${createdUser.setupToken.substring(0, 8)}...`);
      console.log(`[ONBOARD] Stored expires: ${createdUser.setupTokenExpires?.toISOString()}`);
    }

    // Generate verification link for email (point to FRONTEND, not backend)
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    console.log(`--DEV ONLY-- Email verification link for ${email}: ${verificationLink}`);

    // Include dev testing link in response
    const devLink = process.env.NODE_ENV !== 'production' ? verificationLink : undefined;

    res.status(201).json({
      message: 'Onboarding successful. Please verify your email to activate your account.',
      tenant,
      verificationLink: devLink, // For dev testing only
      devTestingNote: process.env.NODE_ENV !== 'production' ? 'DEV MODE: Click the verificationLink directly to test' : undefined,
      nextStep: 'Check your email for a verification link. The link expires in 24 hours.'
    });

    // Send verification email
    // const emailResult = await NotificationService.sendOnboardingEmail(
    //   email,
    //   tenantName,
    //   ownerName || email.split('@')[0],
    //   verificationLink
    // );
    // if (!emailResult.success) {
    //   console.warn(`Failed to send onboarding email to ${email}: ${emailResult.error}`);
    // }

    console.log(`--DEV ONLY-- Onboarding email content for ${email}:\nSubject: Welcome to RetailStack, ${tenantName}!\nBody: Hi ${ownerName || email.split('@')[0]},\n\nThank you for signing up for RetailStack! Please verify your email by clicking the link below:\n\n${verificationLink}\n\nThis link will expire in 24 hours.\n\nBest regards,\nThe RetailStack Team`);

    // Create OTP for phone verification and send via SMS (if phone provided)
    if (phoneNumber) {
      try {
        // generate numeric OTP and its hash
        const { code, hashed } = generateNumericOtp(AUTH_CONFIG.OTP_LENGTH);
        const otpExpires = new Date(Date.now() + AUTH_CONFIG.OTP_EXPIRY_MS); // 10 minutes

        // createdUser is the first user returned by the tenant creation
        const createdUser = tenant.users && tenant.users.length > 0 ? tenant.users[0] : null;
        if (createdUser) {
          await prisma.otpToken.create({
            data: {
              userId: createdUser.id,
              phoneNumber,
              codeHash: hashed,
              expiresAt: otpExpires,
            },
          });
          // Simple converter to turn "09040230325" into "2349040230325"
          let formattedPhone = phoneNumber.trim();
          if (formattedPhone.startsWith('0')) {
            formattedPhone = '234' + formattedPhone.substring(1);
          }

          console.log(`--DEV ONLY-- Generated OTP for ${formattedPhone}: ${code} (expires at ${otpExpires.toISOString()})`);

          const smsResult = await NotificationService.sendOnboardingSMS(formattedPhone, Number(code));
          if (!smsResult.success) {
            console.warn(`Failed to send onboarding OTP SMS to ${formattedPhone}: ${smsResult.error}`);
          }
        }
      } catch (err: any) {
        console.warn('Failed to create/send OTP for onboarding:', err?.message || err);
      }
    }

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

// POST /api/auth/verify-otp - Verify phone OTP for onboarding or phone verification
router.post('/verify-otp', async (req: any, res: any) => {
  const { userId, otp } = req.body;

  if (!userId || !otp) {
    return res.status(400).json({ error: 'userId and otp are required.' });
  }

  try {
    const codeHash = hashToken(String(otp));
    const OTP_ATTEMPT_THRESHOLD = 5;

    // Find OTP record by userId first
    const otpRecord = await prisma.otpToken.findFirst({
      where: {
        userId,
        used: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    // Check if code matches
    if (otpRecord.codeHash !== codeHash) {
      // Code doesn't match - increment attempts in transaction
      const newAttempts = (otpRecord.attempts || 0) + 1;

      await prisma.$transaction([
        prisma.otpToken.update({
          where: { id: otpRecord.id },
          data: {
            attempts: newAttempts,
            ...(newAttempts >= OTP_ATTEMPT_THRESHOLD && { used: true })
          }
        })
      ]);

      if (newAttempts >= OTP_ATTEMPT_THRESHOLD) {
        return res.status(400).json({ error: 'Too many failed OTP attempts. Please request a new code.' });
      }
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    // Code matches - mark as used and verify phone (transaction)
    await prisma.$transaction([
      prisma.otpToken.update({ where: { id: otpRecord.id }, data: { used: true } }),
      prisma.user.update({ where: { id: userId }, data: { phoneVerified: true, phoneVerifiedAt: new Date() } }),
    ]);

    // Log phone verification
    const userRec = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    await AuditService.logAction({
      userId,
      tenantId: userRec?.tenantId || 'unknown',
      action: 'PHONE_VERIFIED',
      resourceType: 'User',
      resourceId: userId,
      description: 'User verified phone via OTP',
    });

    res.json({ message: 'Phone number verified successfully.' });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

// GET /api/auth/verify-email/:token - Verify email address (public endpoint)
router.get('/verify-email/:token', async (req: any, res: any) => {
  const { token } = req.params;

  try {
    console.log(`[VERIFY-EMAIL] Received token (first 8 chars): ${token.substring(0, 8)}...`);
    console.log(`[VERIFY-EMAIL] Token length: ${token.length}`);

    const hashedToken = hashToken(token);
    console.log(`[VERIFY-EMAIL] Hashed token (first 8 chars): ${hashedToken.substring(0, 8)}...`);

    const now = new Date();
    console.log(`[VERIFY-EMAIL] Current time: ${now.toISOString()} (${now.getTime()})`);

    // First, find all users with ANY setupToken for debugging
    const allUsersWithTokens = await prisma.user.findMany({
      where: { setupToken: { not: null } },
      select: { email: true, setupToken: true, setupTokenExpires: true }
    });
    console.log(`[VERIFY-EMAIL] Users with pending verification: ${allUsersWithTokens.length}`);
    allUsersWithTokens.forEach(u => {
      console.log(`  - ${u.email}: token(${u.setupToken?.substring(0, 8)}...), expires: ${u.setupTokenExpires?.toISOString()}`);
      // Compare hashes
      if (u.setupToken === hashedToken) {
        console.log(`    ✓ HASH MATCHES! This is the user.`);
      } else {
        console.log(`    ✗ Hash mismatch. Expected: ${hashedToken.substring(0, 8)}..., Got: ${u.setupToken?.substring(0, 8)}...`);
      }
    });

    const user = await prisma.user.findFirst({
      where: {
        setupToken: hashedToken,
        setupTokenExpires: {
          gt: now // Token hasn't expired
        }
      },
      select: {
        id: true,
        email: true,
        tenantId: true,
        setupToken: true,
        setupTokenExpires: true,
        tenant: {
          select: { name: true }
        }
      }
    });

    if (!user) {
      // Check if token exists but is expired
      const expiredUser = await prisma.user.findFirst({
        where: { setupToken: hashedToken }
      });
      if (expiredUser) {
        const expiry = (expiredUser as any).setupTokenExpires;
        const isExpired = expiry && expiry < now;
        console.log(`[VERIFY-EMAIL] Found user but token is ${isExpired ? 'EXPIRED' : 'NOT MATCHING'}`);
        console.log(`[VERIFY-EMAIL] Token expires: ${expiry?.toISOString()}, current: ${now.toISOString()}`);

        return res.status(400).json({
          error: 'Verification token has expired. Please request a new verification link.',
          code: isExpired ? 'EXPIRED_TOKEN' : 'INVALID_TOKEN',
          details: { isExpired, tokenExpiry: expiry?.toISOString() }
        });
      }

      // Check if this email is already verified (token used previously)
      const verifiedUser = await prisma.user.findFirst({
        where: {
          setupToken: null,
          setupTokenExpires: null,
          email: { not: '' } // Any user without a setup token
        }
      });

      console.log(`[VERIFY-EMAIL] No user found with this token hash. Checking if email is already verified...`);
      console.log(`[VERIFY-EMAIL] Users already verified: ${verifiedUser ? 'YES' : 'NO'}`);

      return res.status(400).json({
        error: 'Invalid or already used verification token. If your email is already verified, please log in instead.',
        code: 'INVALID_OR_ALREADY_VERIFIED'
      });
    }

    console.log(`[VERIFY-EMAIL] ✓ Token valid for user: ${user.email}`);

    // Mark email as verified (clear setup token)
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        setupToken: null,
        setupTokenExpires: null
      }
    });
    console.log(`[VERIFY-EMAIL] ✓ Token cleared for user: ${user.email}`);

    // Return success response FIRST
    res.json({
      message: 'Email verified successfully. You can now log in.',
      user: { email: user.email, tenantId: user.tenantId },
      success: true
    });

    // Send verification confirmation email asynchronously (non-blocking)
    // Errors here should not affect the verification success response
    if (user.tenant) {
      NotificationService.sendEmailVerificationConfirm(
        user.email,
        user.tenant.name,
        `${process.env.BASE_URL || 'https://retailstack-pos.vercel.app/'}/login`
      ).catch(err => {
        // Log email sending failure but don't propagate error
        // User is already verified - this is just a courtesy notification
        console.warn(`[VERIFY-EMAIL] ⚠️ Could not send verification confirmation email to ${user.email}:`, err?.message || err);
      });
    }
  } catch (error: any) {
    console.error('[VERIFY-EMAIL] ❌ Verification error:', error);
    res.status(500).json({
      error: 'Failed to verify email.',
      message: error instanceof Error ? error.message : String(error),
      code: 'VERIFICATION_ERROR'
    });
  }
});

// DEBUG: GET /api/auth/debug/verify-status/:email - Check verification status (DEV ONLY)
router.get('/debug/verify-status/:email', async (req: any, res: any) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Debug endpoint disabled in production' });
  }

  const { email } = req.params;
  const now = new Date();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        setupToken: true,
        setupTokenExpires: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hasToken = !!user.setupToken;
    const isExpired = hasToken && user.setupTokenExpires! < now;
    const timeUntilExpiry = hasToken ? user.setupTokenExpires!.getTime() - now.getTime() : null;
    const isEmailVerified = !hasToken; // Email is verified when setupToken is null

    res.json({
      email: user.email,
      isEmailVerified: isEmailVerified,
      hasVerificationToken: hasToken,
      tokenExpiry: user.setupTokenExpires?.toISOString(),
      isTokenExpired: isExpired,
      timeUntilExpiryMs: timeUntilExpiry,
      timeUntilExpiryHours: timeUntilExpiry ? (timeUntilExpiry / (1000 * 60 * 60)).toFixed(2) : null,
      currentTime: now.toISOString(),
      tokenPreview: user.setupToken ? `${user.setupToken.substring(0, 8)}...${user.setupToken.substring(user.setupToken.length - 8)}` : null
    });
  } catch (error: any) {
    console.error('Debug verify-status error:', error);
    res.status(500).json({
      error: 'Failed to check verification status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/auth/resend-verification-email - Resend email verification link (rate-limited)
router.post('/resend-verification-email', publicLimiter, async (req: any, res: any) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'Email is required.'
    });
  }

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        tenantId: true,
        setupTokenExpires: true,
        tenant: {
          select: { name: true }
        }
      }
    });

    if (!user) {
      // For security, don't reveal if user exists
      return res.status(404).json({
        error: 'User not found.'
      });
    }

    // Check if email is already verified (setupTokenExpires is null)
    if (!user.setupTokenExpires) {
      return res.status(400).json({
        error: 'Email is already verified. Please log in instead.',
        code: 'ALREADY_VERIFIED'
      });
    }

    // Generate new verification token
    const { token: verificationToken, hashed: hashedVerificationToken } = generateToken();
    const verificationExpires = new Date(Date.now() + AUTH_CONFIG.VERIFICATION_TOKEN_EXPIRY_MS); // 24 hours

    // Update user with new verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        setupToken: hashedVerificationToken,
        setupTokenExpires: verificationExpires
      }
    });

    // Generate verification link (point to FRONTEND, not backend)
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    // Send verification email
    const emailResult = await NotificationService.sendOnboardingEmail(
      user.email,
      user.tenant?.name || 'ADINO POS',
      user.email.split('@')[0],
      verificationLink
    );

    if (!emailResult.success) {
      console.warn(`Failed to send verification email to ${user.email}: ${emailResult.error}`);
      return res.status(500).json({
        error: 'Failed to send verification email. Please try again later.',
        code: 'EMAIL_SEND_FAILED'
      });
    }

    res.json({
      message: 'Verification email sent successfully. Please check your inbox.',
      success: true,
      verificationLink: verificationLink // For dev testing
    });
  } catch (error: any) {
    console.error('Resend verification email error:', error);
    res.status(500).json({
      error: 'Failed to resend verification email.',
      message: error instanceof Error ? error.message : String(error),
      code: 'RESEND_ERROR'
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

// POST /api/auth/setup-account-sms - Setup account using SMS code (for users invited via SMS)
router.post('/setup-account-sms', async (req: any, res: any) => {
  const { phone, code, password } = req.body;

  if (!phone || !code || !password) {
    res.status(400).json({ error: 'Phone number, code, and password are required.' });
    return;
  }

  try {
    const OTP_ATTEMPT_THRESHOLD = 5;

    // Find user by phone number
    const user = await prisma.user.findFirst({
      where: { phoneNumber: phone.trim() },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Check if setup is still valid (within 24 hours)
    if (!user.setupTokenExpires || new Date() > user.setupTokenExpires) {
      res.status(400).json({ error: 'Setup code has expired. Please request a new invitation.' });
      return;
    }

    // Find OTP record by userId
    const otpRecord = await prisma.otpToken.findFirst({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired setup code.' });
    }

    // Verify the code matches against database
    const codeHash = hashToken(code);
    if (otpRecord.codeHash !== codeHash) {
      // Code doesn't match - increment attempts in transaction
      const newAttempts = (otpRecord.attempts || 0) + 1;

      await prisma.$transaction([
        prisma.otpToken.update({
          where: { id: otpRecord.id },
          data: {
            attempts: newAttempts,
            ...(newAttempts >= OTP_ATTEMPT_THRESHOLD && { used: true })
          }
        })
      ]);

      if (newAttempts >= OTP_ATTEMPT_THRESHOLD) {
        return res.status(400).json({ error: 'Too many failed setup attempts. Please request a new invitation.' });
      }
      return res.status(400).json({ error: 'Invalid setup code. Please try again.' });
    }

    // Code matches - mark OTP as used and proceed with password setup
    // Hash the new password
    const hashedPassword = await hashPassword(password);


    // Update user with new password, clear setup token, and mark OTP as used (transaction)
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Mark OTP as used
      await tx.otpToken.update({
        where: { id: otpRecord.id },
        data: { used: true }
      });

      // Update user account setup
      return tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          setupToken: null,
          setupTokenExpires: null
        }
      });
    });

    // Log successful account setup
    await AuditService.logAction({
      userId: user.id,
      tenantId: user.tenantId || 'unknown',
      action: 'ACCOUNT_SETUP',
      resourceType: 'user',
      description: 'User completed account setup via SMS invitation',
      ip: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    });

    res.json({
      message: 'Account setup completed successfully.',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role
      }
    });
  } catch (error: any) {
    console.error('Error setting up account via SMS:', error);
    res.status(500).json({
      error: 'Failed to setup account.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/auth/setup-code-info - Get setup code info (attempts and expiry) for SMS-based invitations
router.get('/setup-code-info', async (req: any, res: any) => {
  const { phone } = req.query;

  if (!phone) {
    res.status(400).json({ error: 'Phone number is required.' });
    return;
  }

  try {
    // Find user by email
    const user = await prisma.user.findFirst({
      where: { phoneNumber: (phone as string).trim() },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Check if setup is still valid (within 24 hours)
    if (!user.setupTokenExpires || new Date() > user.setupTokenExpires) {
      res.status(400).json({
        error: 'Setup code has expired. Please request a new invitation.',
        expired: true
      });
      return;
    }

    // Find active OTP record by userId
    const otpRecord = await prisma.otpToken.findFirst({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        attempts: true,
        expiresAt: true,
      }
    });

    if (!otpRecord) {
      res.status(400).json({
        error: 'No active setup code found. Please request a new code.',
        expired: true
      });
      return;
    }

    res.json({
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId
      },
      attempts: otpRecord.attempts || 0,
      expiresAt: otpRecord.expiresAt.toISOString(),
      maxAttempts: 5
    });
  } catch (error: any) {
    console.error('Error fetching setup code info:', error);
    res.status(500).json({
      error: 'Failed to fetch setup code info.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/auth/resend-setup-code - Resend setup code for SMS-based invitations
router.post('/resend-setup-code', publicLimiter, async (req: any, res: any) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // For security, don't reveal if user exists
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Check if setup is still valid (within 24 hours)
    if (!user.setupTokenExpires || new Date() > user.setupTokenExpires) {
      res.status(400).json({ error: 'Setup code has expired. Please request a new invitation.' });
      return;
    }

    // Check if user has phone number (required for SMS)
    if (!user.phoneNumber) {
      res.status(400).json({ error: 'Phone number not found for this user.' });
      return;
    }

    // Mark all existing unused OTP tokens for this user as used
    await prisma.otpToken.updateMany({
      where: {
        userId: user.id,
        used: false
      },
      data: {
        used: true
      }
    });

    // Generate new 6-digit OTP code
    const { code: otpCode, hashed: otpCodeHash } = generateNumericOtp(AUTH_CONFIG.OTP_LENGTH);
    const otpExpires = new Date(Date.now() + AUTH_CONFIG.OTP_EXPIRY_MS); // 10 minutes

    // Create new OTP token record
    await prisma.otpToken.create({
      data: {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        codeHash: otpCodeHash,
        expiresAt: otpExpires,
        attempts: 0,
      },
    });

    // Send SMS with new code
    const setupPageUrl = `${process.env.BASE_URL}/setup`;
    const smsMessage = `Your RetailStack POS setup code: ${otpCode}. Visit ${setupPageUrl} and enter this code to complete your account setup.`;
    console.log(`--DEV ONLY-- Resent SMS to ${user.phoneNumber} with code: ${otpCode}`);

    // Send SMS asynchronously (don't block response)
    NotificationService.sendSMS({
      phoneNumber: user.phoneNumber,
      message: smsMessage
    }).catch(err => {
      console.warn(`Failed to send resend SMS to ${user.phoneNumber}: ${err}`);
    });

    res.json({
      message: 'Setup code has been resent successfully.',
      expiresAt: otpExpires.toISOString(),
      attempts: 0,
      devInfo: process.env.NODE_ENV === 'development' ? {
        smsCode: otpCode
      } : undefined
    });
  } catch (error: any) {
    console.error('Error resending setup code:', error);
    res.status(500).json({
      error: 'Failed to resend setup code.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;



