import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { checkRole } from '../middleware/role.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateToken, generateNumericOtp } from '../src/utils/token.util';
import { NotificationService } from '../src/services/notification.service';
import { hashToken } from '../src/utils/token.util';
import { invalidateUserCache } from '../middleware/auth.middleware';
import dotenv from 'dotenv';


const router = Router();
const prisma = new PrismaClient();
dotenv.config();




router.use(checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]));

router.post('/invite', async (req: AuthRequest, res: any) => {
  const { email, name, role, phoneNumber, notificationMethod = 'email' } = req.body;
  const inviter = req.user!;

  // Validate required fields. phoneNumber only required for SMS invites
  if (!email || !role || (['sms', 'both'].includes(notificationMethod) && !phoneNumber)) {
    res.status(400).json({ error: 'Email, role, and phone number (for SMS) are required.' });
    return;
  }

  // Validate notificationMethod
  if (!['email', 'sms', 'both'].includes(notificationMethod)) {
    res.status(400).json({ error: 'notificationMethod must be "email", "sms", or "both".' });
    return;
  }

  // Owners should not be able to create other Owners via this endpoint
  if (role === UserRole.OWNER) {
    res.status(403).json({ error: 'You cannot invite users with this role.' });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      if (existingUser.email === email) {
        // If roles are the same, return error
        if (existingUser.role === role) {
          res.status(409).json({
            error: 'User already exists with this role.',
            existingUser: {
              id: existingUser.id,
              email: existingUser.email,
              role: existingUser.role
            }
          });
          return;
        }

        // If roles are different, check if it's a role change request
        if (existingUser.role === 'MANAGER') {
          res.status(409).json({
            error: 'User already exists with higher role. Would you like to downgrade the role?',
            existingUser: {
              id: existingUser.id,
              email: existingUser.email,
              currentRole: existingUser.role,
              requestedRole: role
            },
            requiresConfirmation: true
          });
          return;
        }
      } else {
        res.status(409).json({
          error: 'User already exists in another tenant.',
          existingUser: {
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role
          }
        });
        return;
      }
    }

    // Generate setupToken for email-based invitations (24 hours expiry)
    const { token: setupToken, hashed: hashedSetupToken } = generateToken();
    const setupTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Generate 6-digit OTP code for SMS-based invitations (generate but don't create yet)
    let otpCode = null;
    if (['sms', 'both'].includes(notificationMethod)) {
      const { code } = generateNumericOtp(6);
      otpCode = code;
    }

    // Create user: Mark as invited and inactive until setup completes
    // Note: setupToken is ONLY used for email-based invites
    const user = await prisma.user.create({
      data: {
        email,
        name,
        phoneNumber,
        password: 'password_not_set',
        role: role as UserRole,
        tenantId: inviter.tenantId,
        setupToken: hashedSetupToken, // Email token (only used if email method)
        setupTokenExpires,
        status: 'INVITED',
        isActive: false,
      },
    });

    if (!user) {
      res.status(500).json({
        error: 'There was an error creating user'
      });
      return;
    }

    // Now create OTP token for SMS if needed
    if (['sms', 'both'].includes(notificationMethod)) {
      if (!otpCode) {
        res.status(500).json({
          error: 'Failed to generate OTP code'
        });
        return;
      }

      // Use a short-lived OTP for SMS invitations (10 minutes)
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.otpToken.create({
        data: {
          userId: user.id,
          phoneNumber,
          codeHash: otpCode,
          expiresAt: otpExpires,
          attempts: 0,
        },
      });
    }

    // Prepare notification details
    const notificationSummary: { userId: string; email: string; method: any; sentAt: Date; emailSent?: boolean; smsSent?: boolean; codeLength?: number } = {
      userId: user.id,
      email: user.email,
      method: notificationMethod,
      sentAt: new Date()
    };

    // Send email invitation if requested
    if (['email', 'both'].includes(notificationMethod)) {
      const setupLink = `${process.env.FRONTEND_URL}/auth/setup?token=${setupToken}`;
      console.log(`--DEV ONLY-- Email setup link for ${email}: ${setupLink}`);

      // Send invitation email asynchronously (don't block response)
      NotificationService.sendEmail({
        to: email,
        subject: `You're invited to ADINO POS`,
        html: `
          <h2>You're Invited to Join!</h2>
          <p>Hi ${name || email},</p>
          <p>You've been invited to join the team at ADINO POS. Click the link below to set up your account:</p>
          <div style="text-align: center;">
            <a href="${setupLink}" style="display: inline-block; padding: 12px 30px; background: #D4AF37; color: #333; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Complete Account Setup →
            </a>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            <strong>Link expires in 24 hours.</strong> If you didn't expect this invitation, you can safely ignore this email.
          </p>
        `
      }).catch(err => {
        console.warn(`Failed to send invitation email to ${email}: ${err}`);
      });

      notificationSummary.emailSent = true;
    }

    // Send SMS invitation if requested
    if (['sms', 'both'].includes(notificationMethod)) {
      const smsSetupUrl = `${process.env.FRONTEND_URL}/auth/setup`;
      const smsMessage = `Your ADINO POS setup code: ${otpCode}. Visit ${smsSetupUrl} and enter this code to complete your account setup. Code expires in 10 minutes.`;
      console.log(`--DEV ONLY-- SMS sent to ${phoneNumber} with code: ${otpCode}`);

      // Send SMS asynchronously (don't block response)
      NotificationService.sendSMS({
        phoneNumber,
        message: smsMessage
      }).catch(err => {
        console.warn(`Failed to send invitation SMS to ${phoneNumber}: ${err}`);
      });

      notificationSummary.smsSent = true;
      notificationSummary.codeLength = 6;
    }

    await prisma.tenant.update({
      where: { id: inviter.tenantId },
      data: { hasInvitedUser: true }
    });

    // Return success response
    res.status(201).json({
      message: `Invitation sent successfully via ${notificationMethod}.`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt
      },
      notification: notificationSummary,
      devInfo: process.env.NODE_ENV === 'development' ? {
        emailSetupLink: ['email', 'both'].includes(notificationMethod) ? `${process.env.FRONTEND_URL}/auth/setup?token=${setupToken}` : undefined,
        smsSetupCode: ['sms', 'both'].includes(notificationMethod) ? otpCode : undefined
      } : undefined
    });

  } catch (error: any) {
    console.error("Failed to invite user: ", error);
    res.status(500).json({
      error: 'Failed to invite user.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// NOTE: Setup account endpoints have been consolidated to /api/auth/setup-account
// See auth.routes.ts for POST /setup-account and GET /setup-account/:token



// GET /api/users - List users in the tenant with pagination, filtering, and search
router.get('/', async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenantId;
  const { page = 1, limit = 20, role, search } = req.query;
  // const { page = 1, limit = 20, role, isActive, search } = req.query;

  // Build Prisma where clause
  const where: any = { tenantId };
  if (role) where.role = role;
  // if (typeof isActive !== 'undefined') where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneNumber: true,
        createdAt: true,
        // isActive: true,
      },
    }),
    prisma.user.count({ where })
  ]);

  res.json({
    users,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit))
  });
});

// GET /api/users/:id - Get a single user by id (tenant scoped)
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const user = await prisma.user.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phoneNumber: true,
      createdAt: true,
      // isActive: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

// DELETE /api/users/:id - Delete a user by id (tenant scoped, cannot delete self)
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const currentUserId = req.user!.userId;

  if (id === currentUserId) {
    res.status(400).json({ error: 'You cannot delete yourself.' });
    return;
  }

  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  await prisma.user.delete({ where: { id } });
  invalidateUserCache(user.id);
  res.status(204).send();
});

export default router;