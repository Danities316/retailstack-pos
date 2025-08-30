import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { checkRole } from '../middleware/role.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import crypto from 'crypto';
import { hashPassword } from '../services/password.service';
import dotenv from 'dotenv';


const router = Router();
const prisma = new PrismaClient();
dotenv.config();

router.use(checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]));

router.post('/invite', async (req: AuthRequest, res: any) => {
  const { email, name, role, phoneNumber } = req.body;
  const inviter = req.user!;
  console.log("See details: ", req.body)

  if (!email || !role || !phoneNumber) {
    res.status(400).json({ error: 'Email, role, and phone number are required.' });
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
        if (existingUser.role === 'MANAGER' || existingUser.role === 'OWNER' ) {
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

    // If user doesn't exist, proceed with invitation
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const hashedToken = crypto.createHash('sha256').update(setupToken).digest('hex');
    
    const user = await prisma.user.create({
      data: {
        email,
        name,
        phoneNumber,
        password: 'password_not_set',
        role: role as UserRole,
        tenantId: inviter.tenantId,
        setupToken: hashedToken,
        setupTokenExpires,
      },
    });

    if(!user){
      res.status(500).json({
        error: 'There us an error creating User'
      });
      return;
    }
    
    const setupLink = `${process.env.BASE_URL}/api/users/setup-account?token=${setupToken}`;
    console.log(`--DEV ONLY-- Setup link for ${email}: ${setupLink}`);

    res.status(201).json({ message: 'Invitation sent successfully.', user: user });
  } catch (error: any) {
    console.log("Failed to invite user.: ", error)
    res.status(500).json({ error: 'Failed to invite user.', message: error instanceof Error ? error.message : String(error) });
  }
});

// POST /api/users/setup-account - Setup account with token
router.post('/setup-account', async (req: any, res: any) => {
  const { token, password } = req.body;

  if (!token || !password) {
    res.status(400).json({ 
      error: 'Token and password are required.' 
    });
    return;
  }

  try {
    // Hash the token to match the stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: {
        setupToken: hashedToken,
        setupTokenExpires: {
          gt: new Date() // Token hasn't expired
        }
      }
    });

    if (!user) {
      res.status(400).json({ 
        error: 'Invalid or expired setup token.' 
      });
      return;
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password);

    // Update user details
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        setupToken: null, // Clear the setup token
        setupTokenExpires: null // Clear the expiration
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phoneNumber: true
      }
    });

    res.json({ 
      message: 'Account setup completed successfully.',
      user: updatedUser
    });

  } catch (error: any) {
    console.error('Setup account error:', error);
    res.status(500).json({ 
      error: 'Failed to setup account.',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// GET /api/users/setup-account/:token - Verify setup token
router.get('/setup-account/:token', async (req: any, res: any) => {
  const { token } = req.params;

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        setupToken: hashedToken,
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
  res.status(204).send();
});

export default router;