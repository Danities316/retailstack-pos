import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';

const router = Router();
const prisma = new PrismaClient();

// Protect all routes and restrict to Owner/Manager
router.use(checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]));

// GET /api/inventory/logs - Get inventory history, with optional filtering by product
router.get('/logs', async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenantId;
  const { productId } = req.query;

  // Build the filter object based on query parameters
  const whereClause: { tenantId: string; productId?: string } = { tenantId: tenantId! };
  if (productId && typeof productId === 'string') {
    whereClause.productId = productId;
  }

  const logs = await prisma.inventoryLog.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' }, // Show most recent changes first
    include: {
      product: { select: { productName: true } }, // Include product name for context
    },
  });

  res.json(logs);
});

export default router;