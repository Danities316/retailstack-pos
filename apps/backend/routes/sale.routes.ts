import { Router, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import { any } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// POST /api/sales - Create a new sale (Accessible to all roles)
// sale.routes.ts - REPLACING the existing POST /api/sales route

// POST /api/sales - Create a new sale (Accessible to all authenticated roles)
router.post('/', async (req: AuthRequest, res: any) => {

  const { paymentMethod, items } = req.body;

  const tenantId = req.user!.tenantId; // Tenant ID from Auth Token
  const cashierId = req.user!.userId; // Cashier ID from Auth Token
  const cashierRole = req.user!.role; // Cashier Role from Auth Token

  if (!paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Payment method and a non-empty array of items are required.' });
    return;
  }

  let activeShift = null;

  if (cashierRole === 'CASHIER') {
    // Only CASHIERs are REQUIRED to have an active shift
    activeShift = await prisma.shift.findFirst({
      where: { cashierId, tenantId, endTime: null },
      select: { id: true, startFloat: true }
    });

    if (!activeShift) {
      // FORBIDDEN SALE: Cashier is not clocked in
      return res.status(403).json({ error: 'You must clock in to start a shift before making sales.' });
    }
  } else {
    // MANAGER and OWNER roles can make sales without an explicit shift.
    // We still check if they happen to be clocked in, just in case.
    activeShift = await prisma.shift.findFirst({
      where: { cashierId, tenantId, endTime: null },
      select: { id: true, startFloat: true }
    });
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const saleItemsData = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId, tenantId },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        // Stock check (Reliability)
        if (product.stock < item.quantity) {
          throw new Error(`Stockout: Only ${product.stock} units of ${product.productName} available.`);
        }

        // Use the product's current price (security: prevent client-side manipulation)
        const itemPrice = product.sellingPrice;
        totalAmount = Number(totalAmount) + (Number(itemPrice) * Number(item.quantity));

        saleItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          price: itemPrice, // Store the price at time of sale
        });

        // 2. Decrement inventory (Critical for transaction integrity)
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // 3. Create the Sale record
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          userId: cashierId,
          shiftId: activeShift ? activeShift.id : null,
          totalAmount,
          paymentMethod,
          items: {
            createMany: {
              data: saleItemsData,
            },
          },
        },
        include: { items: true },
      });

      return newSale;
    });

    res.status(201).json(sale);

  } catch (error: any) {
    console.error('Sale creation failed:', error);
    // Error Handling: Use empathetic, human-readable feedback (Clarity)
    const message = error.message.includes('Stockout') ? error.message : 'Transaction failed due to an unknown error.';
    res.status(400).json({ error: message });
  }
});

// GET /api/sales - List all sales for the tenant - Restricted to Owner/Manager
router.get('/', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenantId;

  const sales = await prisma.sale.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: { // Include the items for each sale
        include: {
          product: { select: { productName: true } },
        },
      },
    },
  });

  res.json(sales);
});

// GET /api/sales/:id - Get a single sale's details (Restricted to Owner/Manager)
router.get('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const sale = await prisma.sale.findUnique({
    where: { id, tenantId },
    include: {
      items: { include: { product: { select: { productName: true } } } },
    },
  });

  if (!sale) {
    res.status(404).json({ error: 'Sale not found.' });
    return;
  }
  res.json(sale);
});


type SaleItemInput = {
  productId: string;
  quantity: number;
  price: number;
};

router.put('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { items, updatedAt, paymentMethod } = req.body as { items: SaleItemInput[]; updatedAt: string; paymentMethod: string };
  const tenantId = req.user!.tenantId;

  try {
    const existingSale = await prisma.sale.findUnique({
      where: { id, tenantId },
      include: { items: true },
    });

    if (!existingSale) {
      res.status(404).json({ error: 'Sale not found.' });
      return;
    }

    // If client update is newer, apply it
    if (new Date(updatedAt) > existingSale.updatedAt) {
      const updatedSale = await prisma.sale.update({
        where: { id, tenantId },
        data: {
          items: {
            deleteMany: {},
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
          paymentMethod,
        },
      });
      res.json(updatedSale);
      return;
    } else {
      // Server has newer data, ignore client update
      res.status(409).json({ message: 'Conflict: server has newer data', serverData: existingSale });
      return;
    }
  } catch (error) {
    console.error('Sale update failed:', error);
    res.status(500).json({ error: 'Failed to update sale.', details: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/sync', async (req: AuthRequest, res: any) => {
  // Example sync endpoint: return all sales for the tenant (can be adapted)
  try {
    const tenantId = req.user!.tenantId;
    const sales = await prisma.sale.findMany({ where: { tenantId } });
    res.status(200).json({ message: 'Sync successful', sales });
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ error: 'Sync failed', details: error instanceof Error ? error.message : String(error) });
  }
});

export default router;