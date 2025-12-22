import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { checkRole } from '../middleware/role.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { protect } from '../middleware/auth.middleware';
import { hashPassword } from '../services/password.service';

const router = Router();
const prisma = new PrismaClient();


// POST /api/superadmin/tenants - Create tenant (SUPER_ADMIN only)
// Note: Public onboarding is available at POST /api/auth/onboard
router.post('/tenants', async (req: AuthRequest, res: any) => {
  const {
    tenantName,
    owner,
  } = req.body;

  // Support both flat and nested owner structure
  const {
    ownerName = owner?.ownerName,
    ownerEmail = owner?.ownerEmail,
    ownerPassword = owner?.ownerPassword,
    phoneNumber = owner?.phoneNumber,
  } = req.body.owner ? { ...req.body.owner } : req.body;

  // Validate required fields
  if (!tenantName || !ownerEmail || !ownerPassword) {
    res.status(400).json({
      message: 'Tenant Name, Owner Email, and Owner Password are required.',
    });
    return;
  }

  try {
    const hashedPassword = await hashPassword(ownerPassword);

    const newTenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        phoneNumber,
        users: {
          create: {
            email: ownerEmail,
            password: hashedPassword,
            name: ownerName,
            phoneNumber: phoneNumber,
            role: UserRole.OWNER,
          }
        }
      },
      // Select the data you want to return
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        users: {
          select: { id: true, email: true, role: true }
        }
      }
    });

    res.status(201).json({ message: 'Tenant created successfully', tenant: newTenant });

  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create tenant.', message: error instanceof Error ? error.message : String(error) });
  }
});

// Protect all routes in this file and ensure only SUPER_ADMIN can access them
router.use(protect);
router.use(checkRole([UserRole.SUPER_ADMIN]));

// GET /api/superadmin/tenants - List all tenants with their users
router.get('/tenants', async (req, res) => {
  const tenants = await prisma.tenant.findMany({
    where: { users: { some: { role: UserRole.OWNER } } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      createdAt: true,
      users: {
        select: {
          id: true,
          email: true,
          role: true,
          phoneNumber: true,
        }
      }
    }
  })
  res.json(tenants)
})

// GET /api/superadmin/tenants/:id - Get a single tenant's details
router.get('/tenants/:id', async (req: AuthRequest, res: any) => {
  const { id } = req.params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: { users: { select: { id: true, email: true, role: true } } },
  });

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  res.json(tenant);
});

// PUT /api/superadmin/tenants/:id - Update a tenant
router.put('/tenants/:id', async (req, res) => {
  const { id } = req.params;
  const { name, logoUrl, colorScheme } = req.body;

  const updatedTenant = await prisma.tenant.update({
    where: { id },
    data: { name, logoUrl, colorScheme },
  });

  res.json(updatedTenant);
});


// DELETE /api/superadmin/tenants/:id - Delete a tenant by id
router.delete('/tenants/:id', async (req: AuthRequest, res) => {
  const { id } = req.params
  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' })
    return;
  }
  await prisma.tenant.delete({ where: { id } })
  res.status(204).send()
})

export default router;