import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../services/password.service';
import { checkRole } from '../middleware/role.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// This entire route is protected and requires SUPER_ADMIN role
// router.use(checkRole([UserRole.SUPER_ADMIN]));

// POST /api/tenants - Create a new tenant and its first owner
router.post('/', async (req: AuthRequest, res: any) => {
  const { tenantName, ownerEmail, ownerPassword, ownerName, phoneNumber } = req.body;

  if (!tenantName || !ownerEmail || !ownerPassword || !phoneNumber) {
    return res.status(400).json({ error: 'Tenant name, owner email, phoneNumber, and owner password are required.' });
  }

  if (req.user?.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to create a tenant.' });
  }

  try {
    const hashedPassword = await hashPassword(ownerPassword);

    // Use a transaction to ensure both tenant and user are created or neither are.
    const newTenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        phoneNumber: phoneNumber,
        users: {
          create: {
            email: ownerEmail,
            password: hashedPassword,
            phoneNumber: phoneNumber,
            name: ownerName,
            role: "OWNER",
          },
        },
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        createdAt: true,
        users: {
          select: { id: true, email: true, role: true, phoneNumber: true }
        }
      }
    });

    res.status(201).json({ message: 'Tenant created successfully', tenant: newTenant });

  } catch (error: any) {
    // Check for unique constraint violation (e.g., email already exists)
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create tenant.' });
  }
});

export default router;